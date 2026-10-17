-- Stand-ins for the Supabase pieces the migrations lean on, so they run unchanged in the browser.
-- Starts from a clean slate: a half-finished install is simply redone.
drop schema if exists public cascade;
drop schema if exists auth cascade;
create schema public;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role service_role; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;
