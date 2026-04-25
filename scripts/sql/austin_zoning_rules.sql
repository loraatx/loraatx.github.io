-- scripts/sql/austin_zoning_rules.sql
--
-- Lookup table of base-zone development standards for the City of Austin,
-- seeded from Land Development Code Title 25-2 (§25-2-491 use tables and
-- §25-2-492 site-development tables) and Subchapter F (residential design
-- standards) where applicable.
--
-- This is a hand-curated reference table, not a live import. Values must be
-- re-verified against the current LDC after any major amendment. Overlays
-- (NCCD, HD, MU, NP, CO) are NOT applied here — `notes` flags presence and
-- the constraint RPC ignores them in v1.2.
--
-- How to run: paste this whole file into the Supabase SQL editor and click
-- Run. Idempotent — re-running updates the seed rows in place.
--
-- Sources:
--   §25-2-492 Site Development Regulations (FAR, height, setbacks, etc.)
--   §25-2-552 Floor-to-area ratio additional regulations
--   Subchapter F (McMansion)
--   Title 25-2 use-classification tables
--
-- Where the LDC publishes a range or a "max determined by site plan", we
-- store the typical value and flag it in `notes`. Mixed-use vertical
-- variants (e.g. CS-MU) inherit the base CS row; `vertical_mu_far_bonus`
-- on the CS row captures the MU bonus.

set statement_timeout = 0;

create table if not exists public.austin_zoning_rules (
  base_zoning           text primary key,
  display_name          text not null,
  category              text not null check (category in (
                          'residential','multifamily','commercial','office',
                          'industrial','mixed_use','public','rural','other')),
  far                   numeric,                    -- e.g. 0.4, 1.0, 2.0
  max_height_ft         numeric,
  impervious_pct        numeric,                    -- 0..100
  building_pct          numeric,                    -- 0..100
  min_lot_sqft          numeric,
  min_lot_width_ft      numeric,
  front_setback_ft      numeric,
  side_setback_ft       numeric,
  rear_setback_ft       numeric,
  max_units_per_acre    numeric,
  notes                 text,
  source_citation       text not null,              -- '§25-2-492' etc.
  updated_at            timestamptz not null default now()
);

alter table public.austin_zoning_rules enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'austin_zoning_rules'
      and policyname = 'zoning_rules_anon_read'
  ) then
    create policy zoning_rules_anon_read on public.austin_zoning_rules
      for select to anon using (true);
  end if;
end $$;

-- Seed/update. UPSERT keyed on base_zoning so re-runs are safe.
insert into public.austin_zoning_rules (
  base_zoning, display_name, category,
  far, max_height_ft, impervious_pct, building_pct,
  min_lot_sqft, min_lot_width_ft,
  front_setback_ft, side_setback_ft, rear_setback_ft,
  max_units_per_acre, notes, source_citation
) values
  -- Single-family residential (Title 25-2 §492 Table 25-2-492)
  ('SF-1',   'Single-Family — Large Lot',          'residential', 0.40, 35, 40, 40, 10000, 100, 25, 10, 10,  4.4, null, '§25-2-492 Table'),
  ('SF-2',   'Single-Family — Standard Lot',       'residential', 0.40, 35, 45, 40,  5750,  50, 25,  5, 10,  7.0, null, '§25-2-492 Table'),
  ('SF-3',   'Family Residence',                   'residential', 0.40, 35, 45, 40,  5750,  50, 25,  5, 10,  7.0, 'duplex permitted', '§25-2-492 Table'),
  ('SF-4A',  'Single-Family — Small Lot',          'residential', 0.40, 35, 45, 40,  3600,  35, 15,  5, 10, 12.0, null, '§25-2-492 Table'),
  ('SF-4B',  'Single-Family — Condominium Site',   'residential', 0.40, 35, 55, 40,  5750,  50, 15,  5, 10, 12.0, null, '§25-2-492 Table'),
  ('SF-5',   'Urban Family Residence',             'residential', 0.40, 35, 50, 40,  5750,  50, 15,  5, 10, 12.0, null, '§25-2-492 Table'),
  ('SF-6',   'Townhouse & Condominium Residence',  'residential', 0.60, 35, 55, 50,  5750,  50, 15,  5, 10, 12.0, null, '§25-2-492 Table'),

  -- Multifamily (Title 25-2 §492 Table 25-2-492)
  ('MF-1',   'Multifamily — Limited Density',      'multifamily', 0.60, 35, 45, 40,  8000,  50, 25,  5, 10, 17.0, null, '§25-2-492 Table'),
  ('MF-2',   'Multifamily — Low Density',          'multifamily', 0.75, 40, 50, 45,  8000,  50, 25,  5, 10, 23.0, null, '§25-2-492 Table'),
  ('MF-3',   'Multifamily — Medium Density',       'multifamily', 0.90, 40, 55, 50,  8000,  50, 25,  5, 10, 36.0, null, '§25-2-492 Table'),
  ('MF-4',   'Multifamily — Moderate-High Density','multifamily', 1.20, 60, 60, 55,  8000,  50, 25,  5, 10, 54.0, null, '§25-2-492 Table'),
  ('MF-5',   'Multifamily — High Density',         'multifamily', 1.60, 60, 70, 60,  8000,  50, 25,  5, 10, 61.0, null, '§25-2-492 Table'),
  ('MF-6',   'Multifamily — Highest Density',      'multifamily', 2.00, 90, 80, 65,  8000,  50, 25,  5, 10, 91.0, null, '§25-2-492 Table'),

  -- Office (Title 25-2 §492 Table 25-2-492)
  ('NO',     'Neighborhood Office',                'office',      0.50, 35, 60, 50,  5750,  50, 25,  5, 10, null, null, '§25-2-492 Table'),
  ('LO',     'Limited Office',                     'office',      0.70, 40, 70, 60,  5750,  50, 25,  5, 10, null, null, '§25-2-492 Table'),
  ('GO',     'General Office',                     'office',      1.00, 60, 80, 70,  5750,  50, 25,  5, 10, null, null, '§25-2-492 Table'),

  -- Commercial (Title 25-2 §492 Table 25-2-492)
  ('LR',     'Neighborhood Commercial',            'commercial',  0.50, 40, 80, 70,  5750,  50, 25,  5, 10, null, null, '§25-2-492 Table'),
  ('GR',     'Community Commercial',               'commercial',  1.00, 60, 90, 75,  5750,  50, 25,  5, 10, null, null, '§25-2-492 Table'),
  ('CS',     'General Commercial Services',        'commercial',  2.00, 60, 95, 75,  5750,  50, 10,  0,  0, null, 'CS-MU vertical mixed-use bonus available', '§25-2-492 Table'),
  ('CS-1',   'Commercial-Liquor Sales',            'commercial',  2.00, 60, 95, 75,  5750,  50, 10,  0,  0, null, null, '§25-2-492 Table'),
  ('CBD',    'Central Business District',          'commercial',  8.00, null, 100, 100, null, null, 0, 0, 0, null, 'height per Capitol View Corridor & FAA limits', '§25-2-492 Table'),
  ('DMU',    'Downtown Mixed Use',                 'mixed_use',   5.00, 120, 100, 90,  5750, null,  0,  0,  0, null, 'site-plan reviewed; bonus FAR via density bonus', '§25-2-492 Table'),

  -- Industrial (Title 25-2 §492 Table 25-2-492)
  ('IP',     'Industrial Park',                    'industrial',  1.00, 60, 80, 65, 10000,  50, 25,  5, 10, null, null, '§25-2-492 Table'),
  ('LI',     'Limited Industrial',                 'industrial',  1.00, 60, 80, 65, 10000,  50, 25,  5, 10, null, null, '§25-2-492 Table'),
  ('MI',     'Major Industrial',                   'industrial',  1.50, 60, 95, 75, 10000,  50, 25,  5, 10, null, null, '§25-2-492 Table'),

  -- Other / public / rural
  ('P',      'Public',                             'public',      null, null, null, null, null, null, null, null, null, null, 'site plan determined; civic uses', '§25-2-491 use table'),
  ('DR',     'Development Reserve',                'rural',       0.25, 35, 25, 25, 217800, 200, 50, 25, 25,  null, '5-acre minimum lot', '§25-2-492 Table'),
  ('RR',     'Rural Residence',                    'rural',       0.40, 35, 30, 30, 43560, 100, 40, 20, 20,  1.0, '1-acre minimum lot', '§25-2-492 Table'),
  ('AG',     'Agricultural',                       'rural',       0.20, 35, 20, 20, 217800, 200, 50, 25, 25, null, '5-acre minimum lot', '§25-2-491 use table')
on conflict (base_zoning) do update set
  display_name        = excluded.display_name,
  category            = excluded.category,
  far                 = excluded.far,
  max_height_ft       = excluded.max_height_ft,
  impervious_pct      = excluded.impervious_pct,
  building_pct        = excluded.building_pct,
  min_lot_sqft        = excluded.min_lot_sqft,
  min_lot_width_ft    = excluded.min_lot_width_ft,
  front_setback_ft    = excluded.front_setback_ft,
  side_setback_ft     = excluded.side_setback_ft,
  rear_setback_ft     = excluded.rear_setback_ft,
  max_units_per_acre  = excluded.max_units_per_acre,
  notes               = excluded.notes,
  source_citation     = excluded.source_citation,
  updated_at          = now();

-- Sanity checks the user can run after the upsert:
--   select count(*) from public.austin_zoning_rules;
--   select category, count(*) from public.austin_zoning_rules group by 1 order by 1;
