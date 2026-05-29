create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key,
  email text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  company text not null,
  description text not null,
  source_url text,
  status text not null default 'applied' check (status in ('applied', 'interviewing', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists jobs_user_source_url_unique
  on public.jobs (user_id, source_url);

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  base_resume text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.users enable row level security;
alter table public.jobs enable row level security;
alter table public.resumes enable row level security;

create policy "Users can read own profile" on public.users
  for select using (auth.uid() = id);

create policy "Users can upsert own profile" on public.users
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users can manage own jobs" on public.jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can manage own resume" on public.resumes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
