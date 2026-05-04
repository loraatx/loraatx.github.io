-- scripts/sql/refresh_lists.sql
--
-- Defines and refreshes the materialized views that ARE the sellable list
-- products. Each view is named list_<segment>_<slug> and is refreshed on
-- the SKU's cadence by the corresponding GitHub workflow.
--
-- Adding a new SKU = add a CREATE MATERIALIZED VIEW IF NOT EXISTS block,
-- a REFRESH MATERIALIZED VIEW call, and an INSERT INTO list_runs that
-- captures the row count. Nothing else changes.
--
-- Currently shipped:
--   list_contractor_active_permits  (B1)  — weekly

set statement_timeout = 0;

-- ─── B1. Active construction permits, last 90 days, valuation ≥ $50k ───
-- Buyer: GCs, subs (foundation/framing/MEP/roofing), suppliers.
-- Spatial value: parcel-joined and council-district-tagged so a buyer can
-- subscribe to a single district instead of the whole city.
create materialized view if not exists public.list_contractor_active_permits as
select
  p.permit_id,
  p.permit_type,
  p.work_class,
  p.permit_class,
  p.status_current,
  p.issued_date,
  p.total_job_valuation,
  p.total_new_add_sqft,
  p.original_address,
  p.original_zip,
  p.original_city,
  p.council_district,
  p.contractor_company,
  p.applicant_full_name,
  p.parcel_id,
  pa.zoning            as parcel_zoning,
  st_y(p.geom)         as latitude,
  st_x(p.geom)         as longitude
from public.permits p
left join public.parcels pa on pa.parcel_id = p.parcel_id
where p.issued_date >= (current_date - interval '90 days')
  and coalesce(p.status_current, '') in (
    'Active', 'Issued', 'Final Pending', 'Inspections', 'Plan Review'
  )
  and coalesce(p.total_job_valuation, 0) >= 50000
with no data;

create unique index if not exists list_contractor_active_permits_pk
  on public.list_contractor_active_permits (permit_id);
create index if not exists list_contractor_active_permits_district_idx
  on public.list_contractor_active_permits (council_district);
create index if not exists list_contractor_active_permits_workclass_idx
  on public.list_contractor_active_permits (work_class);

-- Refresh + audit. CONCURRENTLY requires the unique index above; safe once
-- the view has been materialized at least once. First run uses non-concurrent.
do $$
declare v_has_data boolean;
begin
  select count(*) > 0 into v_has_data
    from public.list_contractor_active_permits;

  if v_has_data then
    refresh materialized view concurrently public.list_contractor_active_permits;
  else
    refresh materialized view public.list_contractor_active_permits;
  end if;
end $$;

insert into public.list_runs (list_slug, row_count, notes)
select 'contractor_active_permits',
       count(*),
       format('weekly refresh; window=last 90d; min_valuation=50000')
  from public.list_contractor_active_permits;

-- Anon read so the marketing page can show row count + last refresh date.
alter materialized view public.list_contractor_active_permits owner to postgres;
grant select on public.list_contractor_active_permits to anon;

-- Visibility for the workflow log.
select list_slug, row_count, ran_at
  from public.list_runs
 order by ran_at desc
 limit 5;
