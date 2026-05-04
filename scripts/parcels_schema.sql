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

-- Issued construction permits (Socrata 3syk-w9eu).
-- Point geometry derived from latitude/longitude. Joined back to parcels
-- spatially via ST_Contains(parcels.geom, permits.geom) at query time.
create table if not exists public.permits (
  permit_id              text primary key,
  permit_type            text,
  work_class             text,
  permit_class           text,
  status_current         text,
  issued_date            date,
  applied_date           date,
  total_job_valuation    numeric,
  total_existing_sqft    numeric,
  total_new_add_sqft     numeric,
  original_address       text,
  original_zip           text,
  original_city          text,
  council_district       text,
  contractor_company     text,
  applicant_full_name    text,
  parcel_id              text,
  geom                   geometry(Point, 4326),
  metadata               jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists permits_geom_gix      on public.permits using gist (geom);
create index if not exists permits_issued_idx    on public.permits (issued_date);
create index if not exists permits_status_idx    on public.permits (status_current);
create index if not exists permits_workclass_idx on public.permits (work_class);
create index if not exists permits_district_idx  on public.permits (council_district);
create index if not exists permits_parcel_idx    on public.permits (parcel_id);

-- Audit table: every materialized-list refresh writes a row. Drives the
-- "stale upstream" alert (row-count delta > 30% week-over-week) and the
-- "refreshed on" timestamp shown on the marketing page.
create table if not exists public.list_runs (
  id           bigserial primary key,
  list_slug    text not null,
  row_count    bigint not null,
  ran_at       timestamptz not null default now(),
  notes        text
);
create index if not exists list_runs_slug_ran_idx
  on public.list_runs (list_slug, ran_at desc);

-- RLS
alter table public.parcels           enable row level security;
alter table public.parcel_embeddings enable row level security;
alter table public.parcel_documents  enable row level security;
alter table public.permits           enable row level security;
alter table public.list_runs         enable row level security;

drop policy if exists parcels_anon_read           on public.parcels;
drop policy if exists parcel_documents_anon_read  on public.parcel_documents;
drop policy if exists permits_anon_read           on public.permits;
drop policy if exists list_runs_anon_read         on public.list_runs;

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

create policy permits_anon_read
  on public.permits
  for select
  to anon
  using (true);

create policy list_runs_anon_read
  on public.list_runs
  for select
  to anon
  using (true);

-- parcel_embeddings: no anon policy = no anon access.
-- Service-role bypasses RLS for the ingestion scripts.

commit;
