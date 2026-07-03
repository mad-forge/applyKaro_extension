import type { ResumeData } from '@/components/ResumePDF';
import type { AtsReport, ResumeChanges } from '@/lib/ats/types';

const JOB_TTL_MS = 60 * 60 * 1000;

export interface TailorJobResult {
  atsScore: AtsReport['atsScore'];
  gapAnalysis: AtsReport['gapAnalysis'];
  keywordAnalysis: AtsReport['keywordAnalysis'];
  jdAnalysis: AtsReport['jdAnalysis'];
  tailoredAtsScore: {
    score: number;
    breakdown: AtsReport['atsScore']['breakdown'];
  };
  resumeChanges: ResumeChanges;
  tailoredData: ResumeData;
  addedKeywords: ResumeData['addedKeywords'];
  pdfGeneration: {
    mode: 'client';
    instruction: string;
  };
}

export type TailorJob =
  | {
    id: string;
    status: 'pending' | 'processing';
    createdAt: number;
    updatedAt: number;
  }
  | {
    id: string;
    status: 'completed';
    createdAt: number;
    updatedAt: number;
    result: TailorJobResult;
  }
  | {
    id: string;
    status: 'failed';
    createdAt: number;
    updatedAt: number;
    error: string;
    validationErrors?: string[];
  };

export type TailorJobUpdate =
  | {
    status: 'pending' | 'processing';
    updatedAt: number;
  }
  | {
    status: 'completed';
    updatedAt: number;
    result: TailorJobResult;
  }
  | {
    status: 'failed';
    updatedAt: number;
    error: string;
    validationErrors?: string[];
  };

const jobs = new Map<string, TailorJob>();

export function cleanupExpiredJobs() {
  const now = Date.now();
  for (const [jobId, job] of jobs.entries()) {
    if (now - job.updatedAt > JOB_TTL_MS) jobs.delete(jobId);
  }
}

export function createJob() {
  cleanupExpiredJobs();

  const jobId = crypto.randomUUID();
  const now = Date.now();
  jobs.set(jobId, {
    id: jobId,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });

  return jobId;
}

export function getJob(jobId: string) {
  return jobs.get(jobId);
}

export function updateJob(jobId: string, update: TailorJobUpdate) {
  const existing = jobs.get(jobId);
  const createdAt = existing?.createdAt ?? Date.now();
  jobs.set(jobId, { id: jobId, createdAt, ...update });
}

export function serializeJob(job: TailorJob) {
  if (job.status === 'completed') {
    return {
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      result: job.result,
    };
  }

  if (job.status === 'failed') {
    return {
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      error: job.error,
      validationErrors: job.validationErrors,
    };
  }

  return {
    jobId: job.id,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}
