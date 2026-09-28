-- PrismLexi — Supabase schema (Phase 2)
-- Run this ONCE in your Supabase project:  SQL Editor → New query → paste → Run

-- Account-wise history: one row per user holding their project list.
create table if not exists public.prismlexi_history (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  items      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Row Level Security: users can only ever read/write their OWN row.
alter table public.prismlexi_history enable row level security;

create policy "users manage own history"
  on public.prismlexi_history
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Keep updated_at fresh on every write.
create or replace function public.prism_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists prism_touch on public.prismlexi_history;
create trigger prism_touch
  before update on public.prismlexi_history
  for each row execute function public.prism_touch_updated_at();
