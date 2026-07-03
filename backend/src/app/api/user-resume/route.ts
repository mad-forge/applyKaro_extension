import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { createRateLimiter, rateLimitHeaders } from '@/lib/http/rate-limit';

export const runtime = 'nodejs';

const JSON_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const rateLimit = createRateLimiter(60, 60 * 60 * 1000);

const DB_DIR = process.env.VERCEL ? path.join('/tmp', 'applykro-data') : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'user-resumes.json');
const SUPABASE_TABLE = process.env.SUPABASE_USER_RESUMES_TABLE || 'user_resume_preferences';

interface UserProfile {
  email: string;
  id?: string;
}

interface ResumeMetadata {
  name: string;
  type: string;
  size: number;
  lastModified: number;
}

interface UserResumeRecord {
  user: UserProfile;
  resume: ResumeMetadata;
  updatedAt: string;
  storage?: 'local' | 'supabase';
}

type UserResumeDb = Record<string, UserResumeRecord>;

interface SupabaseResumeRow {
  email: string;
  google_id: string;
  resume_name: string;
  resume_type: string;
  resume_size: number;
  resume_last_modified: number;
  resume_metadata: ResumeMetadata;
  updated_at: string;
}

async function readDb(): Promise<UserResumeDb> {
  try {
    const file = await readFile(DB_FILE, 'utf8');
    return JSON.parse(file) as UserResumeDb;
  } catch {
    return {};
  }
}

async function writeDb(db: UserResumeDb) {
  await mkdir(DB_DIR, { recursive: true });
  await writeFile(DB_FILE, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

function toSupabaseRow(record: UserResumeRecord): SupabaseResumeRow {
  return {
    email: record.user.email,
    google_id: record.user.id || '',
    resume_name: record.resume.name,
    resume_type: record.resume.type,
    resume_size: record.resume.size,
    resume_last_modified: record.resume.lastModified,
    resume_metadata: record.resume,
    updated_at: record.updatedAt,
  };
}

function fromSupabaseRow(row: SupabaseResumeRow): UserResumeRecord {
  return {
    user: {
      email: row.email,
      id: row.google_id || '',
    },
    resume: row.resume_metadata || {
      name: row.resume_name,
      type: row.resume_type,
      size: row.resume_size,
      lastModified: row.resume_last_modified,
    },
    updatedAt: row.updated_at,
    storage: 'supabase',
  };
}

async function requestSupabase(pathname: string, init?: RequestInit) {
  const config = getSupabaseConfig();
  if (!config) return null;

  const response = await fetch(`${config.url}/rest/v1/${pathname}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Supabase request failed with ${response.status}`);
  }

  return response;
}

async function getSupabaseRecord(email: string) {
  const response = await requestSupabase(
    `${SUPABASE_TABLE}?email=eq.${encodeURIComponent(email)}&select=*`,
  );
  if (!response) return null;
  const rows = await response.json() as SupabaseResumeRow[];
  return rows[0] ? fromSupabaseRow(rows[0]) : null;
}

async function saveSupabaseRecord(record: UserResumeRecord) {
  const response = await requestSupabase(
    `${SUPABASE_TABLE}?on_conflict=email`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(toSupabaseRow(record)),
    },
  );
  if (!response) return null;
  const rows = await response.json() as SupabaseResumeRow[];
  return rows[0] ? fromSupabaseRow(rows[0]) : { ...record, storage: 'supabase' as const };
}

function normalizeEmail(value: unknown) {
  const email = String(value || '').trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : '';
}

function validateResume(value: unknown): ResumeMetadata | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<ResumeMetadata>;
  const name = String(record.name || '').trim().slice(0, 255);
  const type = String(record.type || 'application/pdf').trim().slice(0, 100);
  const size = Number(record.size || 0);
  const lastModified = Number(record.lastModified || Date.now());
  if (!name || !Number.isFinite(size) || size <= 0 || size > 100 * 1024 * 1024) return null;
  if (!Number.isFinite(lastModified)) return null;
  return { name, type, size, lastModified };
}

export async function GET(req: NextRequest) {
  const email = normalizeEmail(req.nextUrl.searchParams.get('email'));
  if (!email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400, headers: JSON_HEADERS });
  }

  try {
    const supabaseRecord = await getSupabaseRecord(email);
    if (supabaseRecord) {
      return NextResponse.json({ record: supabaseRecord }, { headers: JSON_HEADERS });
    }
  } catch (error) {
    console.warn('Supabase user-resume lookup failed:', error);
  }

  const db = await readDb();
  return NextResponse.json({ record: db[email] || null, storage: 'local' }, { headers: JSON_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(req);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { ...JSON_HEADERS, ...rateLimitHeaders(limit) } },
      );
    }

    const body = await req.json();
    const email = normalizeEmail(body?.user?.email);
    const resume = validateResume(body?.resume);

    if (!email || !resume) {
      return NextResponse.json({ error: 'Missing user email or resume metadata' }, { status: 400, headers: JSON_HEADERS });
    }

    const db = await readDb();
    const record: UserResumeRecord = {
      user: {
        email,
        id: String(body?.user?.id || ''),
      },
      resume,
      updatedAt: new Date().toISOString(),
    };

    try {
      const supabaseRecord = await saveSupabaseRecord(record);
      if (supabaseRecord) {
        return NextResponse.json({ record: supabaseRecord, storage: 'supabase' }, { headers: JSON_HEADERS });
      }
    } catch (error) {
      console.warn('Supabase user-resume save failed, using local fallback:', error);
    }

    db[email] = record;
    await writeDb(db);

    return NextResponse.json({ record: { ...record, storage: 'local' }, storage: 'local' }, { headers: JSON_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save resume record';
    return NextResponse.json({ error: message }, { status: 500, headers: JSON_HEADERS });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: JSON_HEADERS,
  });
}
