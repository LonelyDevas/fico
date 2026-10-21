-- Local-only plumbing for offline sync. Not part of the server schema.

-- Calls and table writes made while offline, waiting to be replayed against Supabase in order.
create table public._sync_outbox (
  seq bigserial primary key,
  op_id uuid not null default gen_random_uuid(),
  kind text not null,                       -- 'rpc' | 'table'
  payload jsonb not null,
  ids jsonb not null default '[]'::jsonb,   -- ids of rows the call inserted, in insert order
  status text not null default 'pending',   -- 'pending' | 'failed'
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

-- Ids of rows inserted by the operation currently running (cleared before each one).
create table public._sync_id_log (
  seq bigserial primary key,
  id uuid not null
);

create table public._sync_meta (
  key text primary key,
  value jsonb
);

create function public._sync_log_id() returns trigger language plpgsql as $$
begin
  insert into public._sync_id_log (id) values (new.id);
  return new;
end;
$$;

-- Flags the running transaction as having changed data, so read-only calls don't get queued.
create function public._sync_mark_dirty() returns trigger language plpgsql as $$
begin
  perform set_config('app.dirty', '1', true);
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'wallets', 'categories', 'transactions', 'bills', 'budgets',
    'obligations', 'investments', 'investment_value_snapshots', 'planned_items'
  ] loop
    execute format('create trigger zz_sync_log_id before insert on public.%I for each row execute function public._sync_log_id()', t);
  end loop;
  foreach t in array array[
    'wallets', 'categories', 'transactions', 'bills', 'budgets',
    'obligations', 'investments', 'investment_value_snapshots', 'planned_items', 'profiles', 'user_details'
  ] loop
    execute format('create trigger zz_sync_dirty after insert or update or delete on public.%I for each row execute function public._sync_mark_dirty()', t);
  end loop;
end;
$$;
