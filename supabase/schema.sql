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

-- Pedidos de "Armá tu caso": el formulario, el estado y el caso terminado.
create table if not exists public.pedidos (
  id text primary key,
  status text not null default 'pendiente', -- esperando_pago | pendiente | en_preparacion | listo | rechazado
  data jsonb not null,
  case_id text unique,
  case_data jsonb,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pedidos enable row level security;

create index if not exists pedidos_status_idx on public.pedidos (status, created_at);

-- Fotos de los pedidos: bucket privado, solo lo usa el servidor.
insert into storage.buckets (id, name, public)
values ('pedidos', 'pedidos', false)
on conflict (id) do nothing;
