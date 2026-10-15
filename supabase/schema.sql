-- Tabla de partidas. Solo el servidor (service role) lee y escribe:
-- RLS activado y sin políticas públicas, así el navegador nunca accede directo.
create table if not exists public.rooms (
  code text primary key,
  state jsonb not null,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rooms enable row level security;

create index if not exists rooms_updated_at_idx on public.rooms (updated_at);
