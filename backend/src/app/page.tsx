const ENDPOINTS = [
  { method: "POST", path: "/api/tailor", description: "Tailor a resume against a job description" },
  { method: "GET", path: "/api/tailor?jobId=...", description: "Poll a tailoring job's status/result" },
  { method: "POST", path: "/api/analyze", description: "Score a resume against a job description" },
  { method: "POST", path: "/api/user-resume", description: "Store/sync a user's saved resume" },
];

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-xl flex-col gap-8 px-8 py-16">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <h1 className="text-xl font-semibold tracking-tight text-black dark:text-zinc-50">
            ApplyKro API
          </h1>
        </div>

        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          This is the backend for the ApplyKro Chrome extension. There is no UI here —
          it only serves the API routes the extension calls.
        </p>

        <div className="flex flex-col divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {ENDPOINTS.map((endpoint) => (
            <div key={endpoint.path} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-3">
              <code className="shrink-0 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {endpoint.method}
              </code>
              <code className="shrink-0 text-sm text-black dark:text-zinc-50">{endpoint.path}</code>
              <span className="text-xs text-zinc-500 dark:text-zinc-500">{endpoint.description}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
