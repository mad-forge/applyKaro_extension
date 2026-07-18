import { Agent, fetch as undiciFetch } from 'undici';

const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_ALLOW_SELF_SIGNED = process.env.OPENROUTER_ALLOW_SELF_SIGNED === 'true';
const DEFAULT_MODEL = 'meta-llama/llama-3.3-70b-instruct';
// OCR reads images/scanned PDFs, so it needs a multimodal model even when the
// main AI_MODEL is text-only (e.g. Llama 3.3).
const DEFAULT_VISION_MODEL = 'google/gemini-2.5-flash-lite';

const INSECURE_OPENROUTER_AGENT = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
});

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { filename: string; file_data: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  model?: string;
  responseFormat?: 'json' | 'text';
  plugins?: { id: string; pdf?: { engine: string } }[];
}

export function getOpenRouterConfig() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key is missing. Add OPENROUTER_API_KEY to backend/.env.local and restart the backend.');
  }

  return {
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: OPENROUTER_BASE_URL.replace(/\/+$/, ''),
    model: process.env.AI_MODEL || DEFAULT_MODEL,
    visionModel: process.env.AI_VISION_MODEL || DEFAULT_VISION_MODEL,
  };
}

export function getVisionModel() {
  return process.env.AI_VISION_MODEL || DEFAULT_VISION_MODEL;
}

export function isOpenRouterConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

function createOpenRouterFetchError(error: unknown) {
  const cause = error instanceof Error ? error.cause : undefined;
  const causeCode = cause && typeof cause === 'object' && 'code' in cause ? cause.code : undefined;

  if (causeCode === 'SELF_SIGNED_CERT_IN_CHAIN') {
    return new Error('OpenRouter TLS verification failed because a self-signed certificate is in the chain. Trust your proxy/root certificate, or set OPENROUTER_ALLOW_SELF_SIGNED=true in backend/.env.local for local development.');
  }

  // undici's abort errors are not DOMException instances, so match on name.
  if (error instanceof Error && (error.name === 'TimeoutError' || /aborted due to timeout/i.test(error.message))) {
    return new Error('The AI provider timed out. Please retry in a moment.');
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return new Error('The AI request was aborted. Please retry.');
  }

  if (error instanceof TypeError) {
    return new Error('Could not reach OpenRouter from the backend. Check your internet connection, API URL, or proxy settings.');
  }

  return error;
}

export async function chatCompletion(options: ChatCompletionOptions): Promise<string> {
  const { apiKey, baseUrl, model } = getOpenRouterConfig();

  let response: Response;
  try {
    const fetchOptions: RequestInit = {
      method: 'POST',
      signal: AbortSignal.timeout(options.timeoutMs ?? 45_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Resume Tailor',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model || model,
        temperature: options.temperature ?? 0.1,
        max_tokens: options.maxTokens ?? 4_000,
        ...(options.responseFormat === 'text' ? {} : { response_format: { type: 'json_object' } }),
        ...(options.plugins ? { plugins: options.plugins } : {}),
        messages: options.messages,
      }),
    };

    if (OPENROUTER_ALLOW_SELF_SIGNED) {
      response = await undiciFetch(`${baseUrl}/chat/completions`, {
        ...fetchOptions,
        dispatcher: INSECURE_OPENROUTER_AGENT,
      } as Parameters<typeof undiciFetch>[1]) as unknown as Response;
    } else {
      response = await fetch(`${baseUrl}/chat/completions`, fetchOptions);
    }
  } catch (error) {
    throw createOpenRouterFetchError(error);
  }

  if (response.url.includes('blocked.teams.cloudflare.com')) {
    throw new Error('OpenRouter is blocked by your network/security policy. Try a different network, VPN/hotspot, or ask your administrator to allow openrouter.ai.');
  }

  if (!response.ok) {
    const detail = await response.text();
    console.error('OpenRouter Error:', response.status, detail.slice(0, 500));
    throw new Error(`OpenRouter API error (${response.status}). Check your API key, credits, and selected model.`);
  }

  const result = await response.json() as {
    choices?: { message?: { content?: unknown } }[];
  };
  const content = result.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI returned an empty response');
  }

  return content;
}

export function extractJsonObject(content: string) {
  const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim();
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) return cleaned;

  const start = cleaned.indexOf('{');
  if (start === -1) return cleaned;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < cleaned.length; index += 1) {
    const character = cleaned[index];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = inString;
      continue;
    }
    if (character === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    if (depth === 0) return cleaned.slice(start, index + 1);
  }

  return cleaned.slice(start);
}
