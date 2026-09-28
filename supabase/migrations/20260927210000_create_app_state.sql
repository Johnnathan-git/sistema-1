-- Persistent cloud state used by the UOS PMS localStorage synchronization layer.
-- The application uses its own hotel login/session layer, so the public Supabase
-- key is the transport credential for this shared application state table.

create table if not exists public.app_state (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "app_state_public_all" on public.app_state;
create policy "app_state_public_all"
  on public.app_state
  as permissive
  for all
  to anon, authenticated
  using (true)
  with check (true);

create or replace function public.set_app_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_state_set_updated_at on public.app_state;
create trigger app_state_set_updated_at
  before update on public.app_state
  for each row
  execute function public.set_app_state_updated_at();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_state'
  ) then
    alter publication supabase_realtime add table public.app_state;
  end if;
end
$$;
