create extension if not exists pgcrypto;

-- IMPORTANT:
-- Run this file as plain SQL in the Supabase SQL Editor.
-- If you ever see `syntax error at or near "@@"`, the pasted text likely
-- contains Git diff markers (e.g. `@@ ... @@`, lines starting with `+` or `-`).
-- Remove those markers and execute only valid SQL statements.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.app_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role_label text not null default 'Monteur',
  is_admin boolean not null default false,
  is_active boolean not null default true,
  vacation_allowance_hours numeric(10,2) not null default 0,
  booked_vacation_hours numeric(10,2) not null default 0,
  carryover_overtime_hours numeric(10,2) not null default 0,
  reported_hours numeric(10,2) not null default 0,
  credited_hours numeric(10,2) not null default 0,
  weekly_hours numeric(10,2) not null default 40,
  target_revenue numeric(12,2) not null default 0,
  school_day_1 smallint,
  school_day_2 smallint,
  block_schedule jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.app_profiles(id) on delete cascade,
  work_date date not null,
  year integer,
  kw integer,
  abz_typ integer not null default 0,
  project_name text,
  commission_number text not null,
  start_time time not null default '07:00',
  end_time time not null default '16:30',
  lunch_break_minutes integer not null default 60,
  additional_break_minutes integer not null default 30,
  total_work_minutes integer not null default 0,
  adjusted_work_minutes integer not null default 0,
  expenses_amount numeric(10,2) not null default 0,
  other_costs_amount numeric(10,2) not null default 0,
  expense_note text,
  notes text,
  controll text,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.holiday_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.app_profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  request_type text not null check (request_type in ('ferien', 'militaer', 'zivildienst', 'unfall', 'krankheit', 'feiertag')),
  notes text,
  controll_pl text,
  controll_gl text,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint holiday_requests_range_check check (end_date >= start_date)
);

create table if not exists public.request_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  profile_id uuid not null references public.app_profiles(id) on delete cascade,
  request text not null,
  context text not null
);

create table if not exists public.daily_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.app_profiles(id) on delete cascade,
  assignment_date date not null,
  project_id uuid references public.projects(id) on delete set null,
  label text not null,
  source text not null default 'manual',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint daily_assignments_unique_profile_day unique (profile_id, assignment_date)
);

alter table public.daily_assignments
drop column if exists assignment_type;

create table if not exists public.platform_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  label text not null,
  is_paid boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.school_vacations (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint school_vacations_range_check check (end_date >= start_date)
);

alter table public.app_profiles
add column if not exists is_admin boolean not null default false;

alter table public.app_profiles
add column if not exists is_active boolean not null default true;

alter table public.app_profiles
add column if not exists vacation_allowance_hours numeric(10,2) not null default 0;

alter table public.app_profiles
add column if not exists booked_vacation_hours numeric(10,2) not null default 0;

alter table public.app_profiles
add column if not exists carryover_overtime_hours numeric(10,2) not null default 0;

alter table public.app_profiles
add column if not exists reported_hours numeric(10,2) not null default 0;

alter table public.app_profiles
add column if not exists credited_hours numeric(10,2) not null default 0;

alter table public.app_profiles
add column if not exists weekly_hours numeric(10,2) not null default 40;

alter table public.app_profiles
add column if not exists target_revenue numeric(12,2) not null default 0;

alter table public.app_profiles
add column if not exists school_day_1 smallint;

alter table public.app_profiles
add column if not exists school_day_2 smallint;

alter table public.app_profiles
add column if not exists block_schedule jsonb not null default '[]'::jsonb;

alter table public.weekly_reports
add column if not exists controll text;

alter table public.weekly_reports
add column if not exists project_name text;

alter table public.weekly_reports
add column if not exists adjusted_work_minutes integer not null default 0;

alter table public.weekly_reports
add column if not exists year integer;

alter table public.weekly_reports
add column if not exists kw integer;

alter table public.weekly_reports
add column if not exists abz_typ integer not null default 0;

alter table public.holiday_requests
add column if not exists controll_pl text;

alter table public.holiday_requests
add column if not exists controll_gl text;

alter table public.platform_holidays
add column if not exists is_paid boolean not null default true;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_profiles
    where id = auth.uid()
      and is_admin = true
  );
$$;

create or replace function public.build_holiday_request_history_text(request_row public.holiday_requests)
returns text
language sql
stable
as $$
  select trim(
    both ' | ' from concat_ws(
      ' | ',
      coalesce(request_row.request_type, 'Absenzantrag'),
      case
        when request_row.start_date is not null and request_row.end_date is not null
          then request_row.start_date::text || ' bis ' || request_row.end_date::text
        else null
      end,
      nullif(trim(coalesce(request_row.notes, '')), '')
    )
  );
$$;

create or replace function public.approve_holiday_request(
  p_request_id uuid,
  p_field_name text,
  p_approval_name text
)
returns public.holiday_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  current_request public.holiday_requests%rowtype;
  updated_request public.holiday_requests%rowtype;
  archive_context text;
begin
  if p_field_name not in ('controll_pl', 'controll_gl') then
    raise exception 'Ungültiges Freigabefeld: %', p_field_name;
  end if;

  select *
  into current_request
  from public.holiday_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Absenzgesuch % wurde nicht gefunden.', p_request_id;
  end if;

  if p_field_name = 'controll_pl' then
    update public.holiday_requests
    set controll_pl = p_approval_name
    where id = p_request_id
    returning * into updated_request;
  else
    update public.holiday_requests
    set controll_gl = p_approval_name
    where id = p_request_id
    returning * into updated_request;
  end if;

  if nullif(trim(coalesce(updated_request.controll_pl, '')), '') is not null
    and nullif(trim(coalesce(updated_request.controll_gl, '')), '') is not null then
    insert into public.weekly_reports (
      profile_id,
      work_date,
      year,
      kw,
      project_name,
      commission_number,
      abz_typ,
      start_time,
      end_time,
      lunch_break_minutes,
      additional_break_minutes,
      total_work_minutes,
      adjusted_work_minutes,
      expenses_amount,
      other_costs_amount,
      expense_note,
      notes,
      controll,
      attachments
    )
    select
      updated_request.profile_id,
      work_day::date,
      extract(isoyear from work_day)::integer,
      extract(week from work_day)::integer,
      initcap(replace(coalesce(updated_request.request_type, 'Absenz'), '_', ' ')),
      initcap(replace(coalesce(updated_request.request_type, 'Absenz'), '_', ' ')),
      case lower(coalesce(updated_request.request_type, ''))
        when 'ferien' then 1
        when 'fehlen' then 1
        when 'krankheit' then 2
        when 'militaer' then 3
        when 'zivildienst' then 3
        when 'unfall' then 4
        when 'feiertag' then 5
        when 'uk' then 6
        when 'ük' then 6
        when 'berufsschule' then 7
        else 0
      end,
      '07:00'::time,
      '16:30'::time,
      60,
      30,
      480,
      480,
      0,
      0,
      '',
      format('Automatisch aus bestätigter Absenz (%s).', initcap(replace(coalesce(updated_request.request_type, 'Absenz'), '_', ' '))),
      '',
      '[]'::jsonb
    from generate_series(updated_request.start_date, updated_request.end_date, interval '1 day') as work_day
    where extract(isodow from work_day) between 1 and 5
      and not exists (
        select 1
        from public.weekly_reports existing
        where existing.profile_id = updated_request.profile_id
          and existing.work_date = work_day::date
      );

    archive_context := format(
      'Bestätigt durch PL: %s | GL: %s',
      updated_request.controll_pl,
      updated_request.controll_gl
    );

    insert into public.request_history (profile_id, request, context)
    values (
      updated_request.profile_id,
      public.build_holiday_request_history_text(updated_request),
      archive_context
    );

    delete from public.holiday_requests
    where id = updated_request.id;
  end if;

  return updated_request;
end;
$$;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  commission_number text not null,
  name text not null,
  allow_expenses boolean not null default true,
  project_lead_profile_id uuid references public.app_profiles(id) on delete set null,
  construction_lead_profile_id uuid references public.app_profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('kunde', 'lieferant', 'elektroplaner', 'subunternehmer', 'unternehmer')),
  company_name text,
  first_name text not null,
  last_name text not null,
  street text,
  city text,
  postal_code text,
  phone text,
  email text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if to_regclass('public.notes') is null and to_regclass('public.crm_notes') is not null then
    alter table public.crm_notes rename to notes;
  end if;
end;
$$;

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  target_uid uuid not null,
  note_type text not null default 'crm',
  note_text text not null,
  sender_uid uuid not null references public.app_profiles(id) on delete restrict,
  recipient_uid uuid references public.app_profiles(id) on delete set null,
  note_category text not null default 'information',
  requires_response boolean not null default false,
  visible_from_date date,
  note_ranking smallint not null default 2 check (note_ranking between 1 and 3),
  attachments jsonb not null default '[]'::jsonb,
  note_flow jsonb not null default '[]'::jsonb,
  note_pos_x integer not null default 24,
  note_pos_y integer not null default 24,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.notes
add column if not exists note_type text not null default 'crm';

alter table public.notes
add column if not exists sender_uid uuid references public.app_profiles(id) on delete restrict;

alter table public.notes
add column if not exists recipient_uid uuid references public.app_profiles(id) on delete set null;

alter table public.notes
add column if not exists note_category text not null default 'information';

alter table public.notes
add column if not exists requires_response boolean not null default false;

alter table public.notes
add column if not exists visible_from_date date;

alter table public.notes
add column if not exists note_ranking smallint not null default 2;

alter table public.notes
add column if not exists attachments jsonb not null default '[]'::jsonb;

alter table public.notes
add column if not exists note_flow jsonb not null default '[]'::jsonb;


alter table public.notes
add column if not exists note_pos_x integer not null default 24;

alter table public.notes
add column if not exists note_pos_y integer not null default 24;

alter table public.notes
alter column recipient_uid drop not null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notes'
      and column_name = 'sender_uid'
      and is_nullable = 'YES'
  ) then
    update public.notes
    set sender_uid = (
      select id
      from public.app_profiles
      order by created_at
      limit 1
    )
    where sender_uid is null;
    alter table public.notes alter column sender_uid set not null;
  end if;
end;
$$;

alter table public.notes
drop constraint if exists notes_disco_status_check;

drop index if exists public.notes_disco_status_idx;

alter table public.notes
drop column if exists disco_status;

alter table public.notes
drop column if exists disco_scheduled_for;

alter table public.notes
drop column if exists disco_done_at;

create table if not exists public.project_disco_layers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  week_start_date date not null,
  profile_uid uuid not null references public.app_profiles(id) on delete cascade,
  sort_order integer not null default 1,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_disco_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  layer_id uuid references public.project_disco_layers(id) on delete cascade,
  plan_date date,
  sort_order integer not null default 1,
  created_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notes_note_ranking_check'
      and conrelid = 'public.notes'::regclass
  ) then
    alter table public.notes
      add constraint notes_note_ranking_check check (note_ranking between 1 and 3);
  end if;
end;
$$;

alter table public.projects
add column if not exists project_lead_profile_id uuid references public.app_profiles(id) on delete set null;

alter table public.projects
add column if not exists construction_lead_profile_id uuid references public.app_profiles(id) on delete set null;

alter table public.projects
add column if not exists allow_expenses boolean not null default true;

create unique index if not exists projects_commission_number_idx
on public.projects (commission_number);

drop table if exists public.project_assignments cascade;
drop table if exists public.bot_profiles cascade;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
alter table public.crm_contacts enable row level security;
alter table public.notes enable row level security;
alter table public.school_vacations enable row level security;
alter table public.project_disco_layers enable row level security;
alter table public.project_disco_entries enable row level security;

drop policy if exists "projects own or admin" on public.projects;
create policy "projects own or admin"
on public.projects
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "crm_contacts admin access" on public.crm_contacts;
create policy "crm_contacts admin access"
on public.crm_contacts
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "notes admin access" on public.notes;
create policy "notes admin access"
on public.notes
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "school_vacations admin access" on public.school_vacations;
create policy "school_vacations admin access"
on public.school_vacations
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "project_disco_layers admin access" on public.project_disco_layers;
create policy "project_disco_layers admin access"
on public.project_disco_layers
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "project_disco_entries admin access" on public.project_disco_entries;
create policy "project_disco_entries admin access"
on public.project_disco_entries
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create or replace function public.reject_holiday_request(
  p_request_id uuid,
  p_context text default 'Abgelehnt'
)
returns public.holiday_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_request public.holiday_requests%rowtype;
begin
  with removed_request as (
    delete from public.holiday_requests
    where id = p_request_id
    returning *
  )
  select *
  into deleted_request
  from removed_request;

  if not found then
    raise exception 'Absenzgesuch % wurde nicht gefunden.', p_request_id;
  end if;

  insert into public.request_history (profile_id, request, context)
  values (
    deleted_request.profile_id,
    public.build_holiday_request_history_text(deleted_request),
    coalesce(nullif(trim(p_context), ''), 'Abgelehnt')
  );

  return deleted_request;
end;
$$;

create or replace function public.purge_user_account(
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth, storage
as $$
begin
  if p_profile_id is null then
    raise exception 'Profil-ID fehlt.';
  end if;
  if not public.is_admin_user() then
    raise exception 'Nur Admin darf Benutzer restlos entfernen.';
  end if;
  if auth.uid() = p_profile_id then
    raise exception 'Eigenes Profil kann nicht gelöscht werden.';
  end if;

  delete from storage.objects
  where bucket_id = 'weekly-attachments'
    and name like p_profile_id::text || '/%';

  delete from auth.users
  where id = p_profile_id;
end;
$$;

create index if not exists weekly_reports_profile_work_date_idx on public.weekly_reports (profile_id, work_date);
create index if not exists weekly_reports_year_kw_idx on public.weekly_reports (year, kw);
create index if not exists holiday_requests_profile_dates_idx on public.holiday_requests (profile_id, start_date, end_date);
create index if not exists request_history_profile_created_at_idx on public.request_history (profile_id, created_at desc);
create index if not exists daily_assignments_profile_date_idx on public.daily_assignments (profile_id, assignment_date);
create index if not exists crm_contacts_last_name_idx on public.crm_contacts (last_name, first_name);
create index if not exists notes_target_uid_created_at_idx on public.notes (target_uid, created_at desc);
create index if not exists project_disco_layers_project_week_idx on public.project_disco_layers (project_id, week_start_date, sort_order);
create index if not exists project_disco_entries_project_note_idx on public.project_disco_entries (project_id, note_id);

drop trigger if exists set_updated_at_app_profiles on public.app_profiles;
create trigger set_updated_at_app_profiles
before update on public.app_profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_weekly_reports on public.weekly_reports;
create trigger set_updated_at_weekly_reports
before update on public.weekly_reports
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_holiday_requests on public.holiday_requests;
create trigger set_updated_at_holiday_requests
before update on public.holiday_requests
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_daily_assignments on public.daily_assignments;
create trigger set_updated_at_daily_assignments
before update on public.daily_assignments
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_crm_contacts on public.crm_contacts;
create trigger set_updated_at_crm_contacts
before update on public.crm_contacts
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_school_vacations on public.school_vacations;
create trigger set_updated_at_school_vacations
before update on public.school_vacations
for each row
execute function public.set_updated_at();

alter table public.app_profiles enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.holiday_requests enable row level security;
alter table public.daily_assignments enable row level security;

-- Vollzugriff nur für Profile mit is_admin = true.
drop policy if exists "app_profiles own or master" on public.app_profiles;
drop policy if exists "app_profiles select own or master" on public.app_profiles;
drop policy if exists "app_profiles insert own or master" on public.app_profiles;
drop policy if exists "app_profiles update own or master" on public.app_profiles;
drop policy if exists "app_profiles delete own or master" on public.app_profiles;
drop policy if exists "weekly_reports own or master" on public.weekly_reports;
drop policy if exists "holiday_requests own or master" on public.holiday_requests;
drop policy if exists "authenticated full access app_profiles" on public.app_profiles;
drop policy if exists "authenticated full access weekly_reports" on public.weekly_reports;
drop policy if exists "authenticated full access holiday_requests" on public.holiday_requests;
drop policy if exists "app_profiles own or admin" on public.app_profiles;
drop policy if exists "app_profiles insert own or admin" on public.app_profiles;
drop policy if exists "app_profiles update own or admin" on public.app_profiles;
drop policy if exists "app_profiles delete own or admin" on public.app_profiles;
drop policy if exists "weekly_reports own or admin" on public.weekly_reports;
drop policy if exists "holiday_requests own or admin" on public.holiday_requests;
drop policy if exists "daily_assignments own or admin" on public.daily_assignments;

create policy "app_profiles own or admin"
on public.app_profiles
for select
using (public.is_admin_user() or auth.uid() = id);

create policy "app_profiles insert own or admin"
on public.app_profiles
for insert
with check (public.is_admin_user() or auth.uid() = id);

create policy "app_profiles update own or admin"
on public.app_profiles
for update
using (public.is_admin_user() or auth.uid() = id)
with check (public.is_admin_user() or auth.uid() = id);

create policy "app_profiles delete own or admin"
on public.app_profiles
for delete
using (public.is_admin_user() or auth.uid() = id);

create policy "weekly_reports own or admin"
on public.weekly_reports
for all
using (public.is_admin_user() or auth.uid() = profile_id)
with check (public.is_admin_user() or auth.uid() = profile_id);

create policy "holiday_requests own or admin"
on public.holiday_requests
for all
using (public.is_admin_user() or auth.uid() = profile_id)
with check (public.is_admin_user() or auth.uid() = profile_id);

create policy "daily_assignments own or admin"
on public.daily_assignments
for all
using (public.is_admin_user() or auth.uid() = profile_id)
with check (public.is_admin_user() or auth.uid() = profile_id);

insert into storage.buckets (id, name, public)
values ('weekly-attachments', 'weekly-attachments', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('crm-note-attachments', 'crm-note-attachments', true)
on conflict (id) do nothing;

drop policy if exists "weekly attachment read own or master" on storage.objects;
drop policy if exists "weekly attachment write own or master" on storage.objects;
drop policy if exists "authenticated attachment read" on storage.objects;
drop policy if exists "authenticated attachment write" on storage.objects;
drop policy if exists "weekly attachment read own or admin" on storage.objects;
drop policy if exists "weekly attachment write own or admin" on storage.objects;
drop policy if exists "crm note attachment read own or admin" on storage.objects;
drop policy if exists "crm note attachment write own or admin" on storage.objects;

create policy "weekly attachment read own or admin"
on storage.objects
for select
using (
  bucket_id = 'weekly-attachments'
  and (
    public.is_admin_user()
    or auth.uid()::text = split_part(name, '/', 1)
  )
);

create policy "weekly attachment write own or admin"
on storage.objects
for all
using (
  bucket_id = 'weekly-attachments'
  and (
    public.is_admin_user()
    or auth.uid()::text = split_part(name, '/', 1)
  )
)
with check (
  bucket_id = 'weekly-attachments'
  and (
    public.is_admin_user()
    or auth.uid()::text = split_part(name, '/', 1)
  )
);

create policy "crm note attachment read own or admin"
on storage.objects
for select
using (
  bucket_id = 'crm-note-attachments'
  and (
    public.is_admin_user()
    or auth.uid()::text = split_part(name, '/', 1)
  )
);

create policy "crm note attachment write own or admin"
on storage.objects
for all
using (
  bucket_id = 'crm-note-attachments'
  and (
    public.is_admin_user()
    or auth.uid()::text = split_part(name, '/', 1)
  )
)
with check (
  bucket_id = 'crm-note-attachments'
  and (
    public.is_admin_user()
    or auth.uid()::text = split_part(name, '/', 1)
  )
);
