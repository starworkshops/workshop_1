create table if not exists public.content_seals (
  author text primary key,
  title text not null check (octet_length(title) between 1 and 120),
  description text not null check (octet_length(description) between 1 and 4000),
  source_url text not null default '' check (octet_length(source_url) <= 500),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz not null default now()
);

alter table public.content_seals enable row level security;

revoke all on table public.content_seals from anon, authenticated;
grant select, insert, update on table public.content_seals to anon, authenticated;

create policy "El contenido es público"
on public.content_seals for select
to anon, authenticated
using (true);

create policy "La demo puede crear contenido"
on public.content_seals for insert
to anon, authenticated
with check (
  octet_length(title) between 1 and 120
  and octet_length(description) between 1 and 4000
  and octet_length(source_url) <= 500
  and content_hash ~ '^[0-9a-f]{64}$'
);

create policy "La demo puede actualizar contenido"
on public.content_seals for update
to anon, authenticated
using (true)
with check (
  octet_length(title) between 1 and 120
  and octet_length(description) between 1 and 4000
  and octet_length(source_url) <= 500
  and content_hash ~ '^[0-9a-f]{64}$'
);

comment on table public.content_seals is
  'Copia pública de contenido. Solana conserva el hash que permite detectar modificaciones.';
