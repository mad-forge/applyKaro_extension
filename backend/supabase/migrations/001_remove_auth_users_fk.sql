-- Run this once in Supabase SQL editor if `public.users.id` still references `auth.users(id)`.
-- This app uses extension-level demo/default users that may not exist in Supabase Auth.

alter table public.jobs drop constraint if exists jobs_user_id_fkey;
alter table public.resumes drop constraint if exists resumes_user_id_fkey;
alter table public.users drop constraint if exists users_id_fkey;

alter table public.users
  add constraint users_pkey primary key (id);

alter table public.jobs
  add constraint jobs_user_id_fkey
  foreign key (user_id) references public.users(id) on delete cascade;

alter table public.resumes
  add constraint resumes_user_id_fkey
  foreign key (user_id) references public.users(id) on delete cascade;
