-- SQL für Supabase: Dispo-Lücken als RPC-Funktion
-- Führt dieselbe Lückensuche (KW-Bereich + Mindestdauer) serverseitig aus.

create or replace function public.find_dispo_free_gaps(
  p_year integer,
  p_week_from integer,
  p_week_to integer default null,
  p_min_gap_minutes integer default 240,
  p_window_start time default '07:00'::time,
  p_window_end time default '17:00'::time,
  p_role_label text default 'Service',
  p_only_active boolean default true
)
returns table (
  profile_id uuid,
  profile_name text,
  role_label text,
  work_date date,
  iso_year integer,
  iso_week integer,
  free_start time,
  free_end time,
  free_minutes integer,
  is_full_day boolean
)
language sql
security definer
set search_path = public
as $$
with params as (
  select
    p_year::int as year,
    p_week_from::int as week_from,
    coalesce(p_week_to, p_week_from)::int as week_to,
    greatest(p_min_gap_minutes, 1)::int as min_gap_minutes,
    p_window_start::time as window_start,
    p_window_end::time as window_end,
    case
      when p_role_label is null or btrim(p_role_label) = '' then null
      else btrim(p_role_label)
    end as role_filter,
    p_only_active as only_active
), valid as (
  select *
  from params
  where year between 2000 and 2100
    and week_from between 1 and 53
    and week_to between week_from and 53
    and window_end > window_start
), range_dates as (
  select
    to_date(concat(v.year::text, lpad(v.week_from::text, 2, '0'), '1'), 'IYYYIWID') as date_from,
    to_date(concat(v.year::text, lpad(v.week_to::text, 2, '0'), '1'), 'IYYYIWID') + interval '4 days' as date_to,
    v.*
  from valid v
), workdays as (
  select
    d::date as work_date,
    r.*
  from range_dates r,
  generate_series(r.date_from, r.date_to, interval '1 day') as d
  where extract(isodow from d) between 1 and 5
), profiles as (
  select
    p.id as profile_id,
    coalesce(nullif(p.full_name, ''), nullif(p.email, ''), 'Unbekannt') as profile_name,
    p.role_label,
    p.block_schedule,
    w.work_date,
    w.window_start,
    w.window_end,
    w.min_gap_minutes
  from workdays w
  join public.app_profiles p on true
  where (not w.only_active or p.is_active = true)
    and (w.role_filter is null or p.role_label = w.role_filter)
), assignment_intervals as (
  -- Neue Dispo-Struktur: label = 'dispo_items:[{label,start_time,end_time,...}]'
  select
    p.profile_id,
    p.work_date,
    greatest((item->>'start_time')::time, p.window_start) as busy_start,
    least((item->>'end_time')::time, p.window_end) as busy_end
  from profiles p
  join public.daily_assignments da
    on da.profile_id = p.profile_id
   and da.assignment_date = p.work_date
  cross join lateral jsonb_array_elements(
    case
      when da.label like 'dispo_items:%' then substring(da.label from '^dispo_items:(.*)$')::jsonb
      when da.label like '__dispo_items__:%' then substring(da.label from '^__dispo_items__:(.*)$')::jsonb
      else jsonb_build_array(
        jsonb_build_object(
          'start_time', '07:00',
          'end_time', '16:30'
        )
      )
    end
  ) as item
  where (item ? 'start_time')
    and (item ? 'end_time')
    and least((item->>'end_time')::time, p.window_end) > greatest((item->>'start_time')::time, p.window_start)
), block_intervals as (
  -- Blocktage aus app_profiles.block_schedule
  select
    p.profile_id,
    p.work_date,
    greatest((bs->>'start_time')::time, p.window_start) as busy_start,
    least((bs->>'end_time')::time, p.window_end) as busy_end
  from profiles p
  cross join lateral jsonb_array_elements(coalesce(p.block_schedule, '[]'::jsonb)) as bs
  where (bs->>'weekday')::int = extract(isodow from p.work_date)::int
    and least((bs->>'end_time')::time, p.window_end) > greatest((bs->>'start_time')::time, p.window_start)
), busy_raw as (
  select * from assignment_intervals
  union all
  select * from block_intervals
), busy_ordered as (
  select
    b.*,
    lag(b.busy_end) over (partition by b.profile_id, b.work_date order by b.busy_start, b.busy_end) as prev_end
  from busy_raw b
), busy_groups as (
  select
    bo.*,
    sum(
      case
        when bo.prev_end is null or bo.busy_start > bo.prev_end then 1
        else 0
      end
    ) over (partition by bo.profile_id, bo.work_date order by bo.busy_start, bo.busy_end) as grp
  from busy_ordered bo
), busy_merged as (
  select
    profile_id,
    work_date,
    min(busy_start) as busy_start,
    max(busy_end) as busy_end
  from busy_groups
  group by profile_id, work_date, grp
), free_from_empty_days as (
  select
    p.profile_id,
    p.profile_name,
    p.role_label,
    p.work_date,
    p.window_start as free_start,
    p.window_end as free_end,
    p.min_gap_minutes
  from profiles p
  where not exists (
    select 1
    from busy_merged bm
    where bm.profile_id = p.profile_id
      and bm.work_date = p.work_date
  )
), free_from_busy_days as (
  select
    p.profile_id,
    p.profile_name,
    p.role_label,
    p.work_date,
    coalesce(lag(bm.busy_end) over w, p.window_start) as free_start,
    bm.busy_start as free_end,
    p.min_gap_minutes
  from profiles p
  join busy_merged bm
    on bm.profile_id = p.profile_id
   and bm.work_date = p.work_date
  window w as (partition by bm.profile_id, bm.work_date order by bm.busy_start, bm.busy_end)
  union all
  select
    p.profile_id,
    p.profile_name,
    p.role_label,
    p.work_date,
    max(bm.busy_end) as free_start,
    p.window_end as free_end,
    p.min_gap_minutes
  from profiles p
  join busy_merged bm
    on bm.profile_id = p.profile_id
   and bm.work_date = p.work_date
  group by p.profile_id, p.profile_name, p.role_label, p.work_date, p.window_end, p.min_gap_minutes
), free_all as (
  select * from free_from_empty_days
  union all
  select * from free_from_busy_days
)
select
  fa.profile_id,
  fa.profile_name,
  fa.role_label,
  fa.work_date,
  extract(isoyear from fa.work_date)::int as iso_year,
  extract(week from fa.work_date)::int as iso_week,
  fa.free_start,
  fa.free_end,
  (extract(epoch from (fa.free_end - fa.free_start)) / 60)::int as free_minutes,
  fa.free_start = (select window_start from valid limit 1)
    and fa.free_end = (select window_end from valid limit 1) as is_full_day
from free_all fa
where fa.free_end > fa.free_start
  and (extract(epoch from (fa.free_end - fa.free_start)) / 60)::int >= fa.min_gap_minutes
order by fa.work_date, fa.profile_name, fa.free_start;
$$;

grant execute on function public.find_dispo_free_gaps(integer, integer, integer, integer, time, time, text, boolean)
  to authenticated, service_role;
