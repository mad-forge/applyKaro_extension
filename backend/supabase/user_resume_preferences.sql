create table if not exists public.user_resume_preferences (
  email text primary key,
  google_id text not null default '',
  resume_name text not null,
  resume_type text not null default 'application/pdf',
  resume_size bigint not null,
  resume_last_modified bigint not null,
  resume_metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_resume_preferences enable row level security;

drop policy if exists "service role manages user resume preferences"
  on public.user_resume_preferences;

create policy "service role manages user resume preferences"
  on public.user_resume_preferences
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
