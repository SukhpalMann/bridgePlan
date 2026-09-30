-- Run once in the Supabase SQL editor. Only the Vercel function uses the secret key.
create table if not exists public.bridgeplan_runs (
  id uuid primary key,
  created_at timestamptz not null default now(),
  visitor_id uuid not null,
  visitor_slot smallint not null check (visitor_slot between 1 and 5),
  scenario_input jsonb not null,
  calculation jsonb not null,
  model_output jsonb not null,
  status text not null check (status in ('pending', 'completed', 'failed')),
  input_tokens integer,
  output_tokens integer
);

create unique index if not exists bridgeplan_runs_visitor_slot_idx
  on public.bridgeplan_runs (visitor_id, visitor_slot);

create index if not exists bridgeplan_runs_visitor_idx
  on public.bridgeplan_runs (visitor_id, created_at desc);
create index if not exists bridgeplan_runs_status_created_idx
  on public.bridgeplan_runs (status, created_at desc);

alter table public.bridgeplan_runs enable row level security;
revoke all on public.bridgeplan_runs from anon, authenticated;
-- No public policies. The server uses SUPABASE_SERVICE_KEY only.
