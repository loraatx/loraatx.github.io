-- Austin Parcels schema for the /parcels/ app.
-- Target: the existing Supabase project tqnklodtiithbsxxyycp.
-- Idempotent: safe to re-run.
--
-- Run locally:
--   psql "$DATABASE_URL" -f scripts/parcels_schema.sql

begin;

-- Extensions
create extension if not exists postgis;
create extension if not exists pgcrypto;
create extension if not exists vector;

-- Core parcels table
create table if not exists public.parcels (
  parcel_id   text primary key,
  zoning      text,
  geom        geometry(MultiPolygon, 4326) not null,
  centroid    geometry(Point, 4326),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists parcels_geom_gix
  on public.parcels using gist (geom);
create index if not exists parcels_centroid_gix
  on public.parcels using gist (centroid);

-- updated_at trigger
create or replace function public.parcels_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists parcels_touch on public.parcels;
create trigger parcels_touch
  before update on public.parcels
  for each row execute function public.parcels_set_updated_at();

-- RAG-ready stubs (empty in v1)
create table if not exists public.parcel_embeddings (
  id          uuid primary key default gen_random_uuid(),
  parcel_id   text not null references public.parcels(parcel_id) on delete cascade,
  model       text not null,
  embedding   vector(1536) not null,
  created_at  timestamptz not null default now()
);

create index if not exists parcel_embeddings_parcel_idx
  on public.parcel_embeddings(parcel_id);
create index if not exists parcel_embeddings_ivf
  on public.parcel_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table if not exists public.parcel_documents (
  id          uuid primary key default gen_random_uuid(),
  parcel_id   text not null references public.parcels(parcel_id) on delete cascade,
  source      text,
  chunk_ix    integer,
  chunk_text  text,
  embedding   vector(1536),
  created_at  timestamptz not null default now()
);

create index if not exists parcel_documents_parcel_idx
  on public.parcel_documents(parcel_id);

-- RLS
alter table public.parcels           enable row level security;
alter table public.parcel_embeddings enable row level security;
alter table public.parcel_documents  enable row level security;

drop policy if exists parcels_anon_read           on public.parcels;
drop policy if exists parcel_documents_anon_read  on public.parcel_documents;

create policy parcels_anon_read
  on public.parcels
  for select
  to anon
  using (true);

create policy parcel_documents_anon_read
  on public.parcel_documents
  for select
  to anon
  using (true);

-- parcel_embeddings: no anon policy = no anon access.
-- Service-role bypasses RLS for the ingestion scripts.

commit;
