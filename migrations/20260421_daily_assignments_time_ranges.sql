alter table public.daily_assignments
  add column if not exists start_time time;

alter table public.daily_assignments
  add column if not exists end_time time;

update public.daily_assignments
set start_time = coalesce(start_time, '07:00'::time),
    end_time = coalesce(end_time, '16:30'::time)
where start_time is null
   or end_time is null;

alter table public.daily_assignments
  alter column start_time set default '07:00'::time,
  alter column end_time set default '16:30'::time,
  alter column start_time set not null,
  alter column end_time set not null;

alter table public.daily_assignments
  drop constraint if exists daily_assignments_unique_profile_day;

alter table public.daily_assignments
  add constraint daily_assignments_time_range_check check (end_time > start_time);

drop index if exists public.daily_assignments_profile_date_idx;
create index if not exists daily_assignments_profile_date_time_idx
  on public.daily_assignments (profile_id, assignment_date, start_time, end_time);
