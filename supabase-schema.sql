create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.app_profiles (
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

create table public.crm_contacts (
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

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.crm_contacts(id) on delete cascade,
  name text not null,
  strasse text not null,
  postleitzahl text not null,
  ort text not null,
  budget numeric(12,2) not null check (budget > 0),
  notizen jsonb not null default '[]'::jsonb,
  dokumente jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  commission_number text not null unique,
  name text not null,
  allow_expenses boolean not null default true,
  budget numeric(12,2) not null default 0,
  property_id uuid references public.properties(id) on delete set null,
  project_lead_profile_id uuid references public.app_profiles(id) on delete set null,
  construction_lead_profile_id uuid references public.app_profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.platform_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  label text not null,
  is_paid boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.school_vacations (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint school_vacations_range_check check (end_date >= start_date)
);

create table public.weekly_reports (
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

create table public.holiday_requests (
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

create table public.request_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  profile_id uuid not null references public.app_profiles(id) on delete cascade,
  request text not null,
  context text not null
);

create table public.daily_assignments (
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

create table public.material_entries (
  id uuid primary key default gen_random_uuid(),
  kommissionsnummer text not null,
  betrag numeric(12,2) not null check (betrag > 0),
  beleg_url text not null,
  beleg_name text,
  beschreibung text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.notes (
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

create table public.project_kanban_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'todo' check (status in ('todo', 'planned', 'in_progress', 'review', 'done')),
  position integer not null default 0,
  content text not null,
  note_type text not null default 'text' check (note_type in ('text', 'todo', 'counter')),
  title text,
  todo_description text,
  todo_items jsonb not null default '[]'::jsonb,
  counter_start_value integer not null default 0,
  counter_value integer not null default 0,
  counter_description text,
  counter_log jsonb not null default '[]'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
  checklist_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.dashboard_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_profiles(id) on delete cascade,
  content text not null default '',
  note_color text not null default 'yellow',
  pos_x integer not null default 0,
  pos_y integer not null default 0,
  width integer not null default 320,
  height integer not null default 220,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table public.dashboard_note_attachments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.dashboard_notes(id) on delete cascade,
  user_id uuid not null references public.app_profiles(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_mime_type text,
  file_size_bytes bigint not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.app_profiles
    where id = auth.uid()
      and is_admin = true
      and is_active = true
  );
$$;

create or replace function public.build_holiday_request_history_text(request_row public.holiday_requests)
returns text
language sql
stable
set search_path = public, pg_temp
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
set search_path = public, pg_temp
as $$
declare
  updated_request public.holiday_requests%rowtype;
  archive_context text;
begin
  if not public.is_admin_user() then
    raise exception 'Nur Admin darf Absenzgesuche freigeben.';
  end if;

  if p_field_name not in ('controll_pl', 'controll_gl') then
    raise exception 'Ungültiges Freigabefeld: %', p_field_name;
  end if;

  perform 1
  from public.holiday_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Absenzgesuch % wurde nicht gefunden.', p_request_id;
  end if;

  if p_field_name = 'controll_pl' then
    update public.holiday_requests
    set controll_pl = p_approval_name,
        updated_at = timezone('utc', now())
    where id = p_request_id
    returning * into updated_request;
  else
    update public.holiday_requests
    set controll_gl = p_approval_name,
        updated_at = timezone('utc', now())
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

create or replace function public.reject_holiday_request(
  p_request_id uuid,
  p_context text default 'Abgelehnt'
)
returns public.holiday_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_request public.holiday_requests%rowtype;
begin
  if not public.is_admin_user() then
    raise exception 'Nur Admin darf Absenzgesuche ablehnen.';
  end if;

  delete from public.holiday_requests
  where id = p_request_id
  returning * into deleted_request;

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
set search_path = public, auth, storage, pg_temp
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

  delete from storage.objects
  where bucket_id = 'crm-note-attachments'
    and name like p_profile_id::text || '/%';

  delete from storage.objects
  where bucket_id = 'project-kanban-attachments'
    and name like p_profile_id::text || '/%';

  delete from storage.objects
  where bucket_id = 'dashboard-note-attachments'
    and name like p_profile_id::text || '/%';

  delete from auth.users
  where id = p_profile_id;
end;
$$;

create index weekly_reports_profile_work_date_idx on public.weekly_reports (profile_id, work_date);
create index weekly_reports_year_kw_idx on public.weekly_reports (year, kw);
create index holiday_requests_profile_dates_idx on public.holiday_requests (profile_id, start_date, end_date);
create index request_history_profile_created_at_idx on public.request_history (profile_id, created_at desc);
create index daily_assignments_profile_date_idx on public.daily_assignments (profile_id, assignment_date);
create index crm_contacts_last_name_idx on public.crm_contacts (last_name, first_name);
create index properties_contact_created_idx on public.properties (contact_id, created_at desc);
create index notes_target_uid_created_at_idx on public.notes (target_uid, created_at desc);
create index project_kanban_notes_project_status_idx on public.project_kanban_notes (project_id, status, position);
create index dashboard_notes_user_id_idx on public.dashboard_notes (user_id);
create index dashboard_note_attachments_note_id_idx on public.dashboard_note_attachments (note_id);

create trigger set_updated_at_app_profiles
before update on public.app_profiles
for each row execute function public.set_updated_at();

create trigger set_updated_at_projects
before update on public.projects
for each row execute function public.set_updated_at();

create trigger set_updated_at_weekly_reports
before update on public.weekly_reports
for each row execute function public.set_updated_at();

create trigger set_updated_at_holiday_requests
before update on public.holiday_requests
for each row execute function public.set_updated_at();

create trigger set_updated_at_daily_assignments
before update on public.daily_assignments
for each row execute function public.set_updated_at();

create trigger set_updated_at_crm_contacts
before update on public.crm_contacts
for each row execute function public.set_updated_at();

create trigger set_updated_at_properties
before update on public.properties
for each row execute function public.set_updated_at();

create trigger set_updated_at_school_vacations
before update on public.school_vacations
for each row execute function public.set_updated_at();

create trigger set_updated_at_project_kanban_notes
before update on public.project_kanban_notes
for each row execute function public.set_updated_at();

create trigger set_updated_at_dashboard_notes
before update on public.dashboard_notes
for each row execute function public.set_updated_at();

create trigger set_updated_at_dashboard_note_attachments
before update on public.dashboard_note_attachments
for each row execute function public.set_updated_at();

alter table public.app_profiles enable row level security;
alter table public.crm_contacts enable row level security;
alter table public.properties enable row level security;
alter table public.projects enable row level security;
alter table public.platform_holidays enable row level security;
alter table public.school_vacations enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.holiday_requests enable row level security;
alter table public.request_history enable row level security;
alter table public.daily_assignments enable row level security;
alter table public.material_entries enable row level security;
alter table public.notes enable row level security;
alter table public.project_kanban_notes enable row level security;
alter table public.dashboard_notes enable row level security;
alter table public.dashboard_note_attachments enable row level security;

create policy "app_profiles select own or admin"
on public.app_profiles
for select
to authenticated
using (public.is_admin_user() or auth.uid() = id);

create policy "app_profiles insert own or admin"
on public.app_profiles
for insert
to authenticated
with check (public.is_admin_user() or auth.uid() = id);

create policy "app_profiles update own or admin"
on public.app_profiles
for update
to authenticated
using (public.is_admin_user() or auth.uid() = id)
with check (public.is_admin_user() or auth.uid() = id);

create policy "app_profiles delete own or admin"
on public.app_profiles
for delete
to authenticated
using (public.is_admin_user() or auth.uid() = id);

create policy "weekly_reports own or admin"
on public.weekly_reports
for all
to authenticated
using (public.is_admin_user() or auth.uid() = profile_id)
with check (public.is_admin_user() or auth.uid() = profile_id);

create policy "holiday_requests own or admin"
on public.holiday_requests
for all
to authenticated
using (public.is_admin_user() or auth.uid() = profile_id)
with check (public.is_admin_user() or auth.uid() = profile_id);

create policy "request_history read own or admin"
on public.request_history
for select
to authenticated
using (public.is_admin_user() or auth.uid() = profile_id);

create policy "request_history insert admin only"
on public.request_history
for insert
to authenticated
with check (public.is_admin_user());

create policy "daily_assignments own or admin"
on public.daily_assignments
for all
to authenticated
using (public.is_admin_user() or auth.uid() = profile_id)
with check (public.is_admin_user() or auth.uid() = profile_id);

create policy "projects read authenticated"
on public.projects
for select
to authenticated
using (true);

create policy "projects write admin"
on public.projects
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "platform_holidays read authenticated"
on public.platform_holidays
for select
to authenticated
using (true);

create policy "platform_holidays write admin"
on public.platform_holidays
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "school_vacations read authenticated"
on public.school_vacations
for select
to authenticated
using (true);

create policy "school_vacations write admin"
on public.school_vacations
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "crm_contacts admin access"
on public.crm_contacts
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "properties admin access"
on public.properties
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "material_entries admin access"
on public.material_entries
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "notes read own related or admin"
on public.notes
for select
to authenticated
using (
  public.is_admin_user()
  or auth.uid() = sender_uid
  or auth.uid() = recipient_uid
  or auth.uid() = target_uid
);

create policy "notes insert own sender or admin"
on public.notes
for insert
to authenticated
with check (
  public.is_admin_user()
  or auth.uid() = sender_uid
);

create policy "notes update own sender or admin"
on public.notes
for update
to authenticated
using (
  public.is_admin_user()
  or auth.uid() = sender_uid
)
with check (
  public.is_admin_user()
  or auth.uid() = sender_uid
);

create policy "notes delete own sender or admin"
on public.notes
for delete
to authenticated
using (
  public.is_admin_user()
  or auth.uid() = sender_uid
);

create policy "project_kanban_notes read authenticated"
on public.project_kanban_notes
for select
to authenticated
using (true);

create policy "project_kanban_notes write admin"
on public.project_kanban_notes
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "dashboard notes read own or admin"
on public.dashboard_notes
for select
to authenticated
using (public.is_admin_user() or auth.uid() = user_id);

create policy "dashboard notes write own or admin"
on public.dashboard_notes
for all
to authenticated
using (public.is_admin_user() or auth.uid() = user_id)
with check (public.is_admin_user() or auth.uid() = user_id);

create policy "dashboard attachments read own or admin"
on public.dashboard_note_attachments
for select
to authenticated
using (public.is_admin_user() or auth.uid() = user_id);

create policy "dashboard attachments write own or admin"
on public.dashboard_note_attachments
for all
to authenticated
using (public.is_admin_user() or auth.uid() = user_id)
with check (public.is_admin_user() or auth.uid() = user_id);

-- WICHTIG: Diese GRANTS verhindern häufige 42501/"permission denied for table"-Fehler.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.is_admin_user() to authenticated;
grant execute on function public.approve_holiday_request(uuid, text, text) to authenticated;
grant execute on function public.reject_holiday_request(uuid, text) to authenticated;
grant execute on function public.purge_user_account(uuid) to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
  grant execute on functions to authenticated;

insert into storage.buckets (id, name, public)
values ('weekly-attachments', 'weekly-attachments', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('crm-note-attachments', 'crm-note-attachments', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('project-kanban-attachments', 'project-kanban-attachments', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('material-belege', 'material-belege', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('dashboard-note-attachments', 'dashboard-note-attachments', true)
on conflict (id) do nothing;

create policy "weekly attachment read own or admin"
on storage.objects
for select
to authenticated
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
to authenticated
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
to authenticated
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
to authenticated
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

create policy "project kanban attachment read own or admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'project-kanban-attachments'
  and (
    public.is_admin_user()
    or auth.uid()::text = split_part(name, '/', 1)
  )
);

create policy "project kanban attachment write own or admin"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'project-kanban-attachments'
  and (
    public.is_admin_user()
    or auth.uid()::text = split_part(name, '/', 1)
  )
)
with check (
  bucket_id = 'project-kanban-attachments'
  and (
    public.is_admin_user()
    or auth.uid()::text = split_part(name, '/', 1)
  )
);

create policy "material attachment read admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'material-belege'
  and public.is_admin_user()
);

create policy "material attachment write admin"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'material-belege'
  and public.is_admin_user()
)
with check (
  bucket_id = 'material-belege'
  and public.is_admin_user()
);

create policy "dashboard attachment read own or admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'dashboard-note-attachments'
  and (
    public.is_admin_user()
    or auth.uid()::text = split_part(name, '/', 1)
  )
);

create policy "dashboard attachment write own or admin"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'dashboard-note-attachments'
  and (
    public.is_admin_user()
    or auth.uid()::text = split_part(name, '/', 1)
  )
)
with check (
  bucket_id = 'dashboard-note-attachments'
  and (
    public.is_admin_user()
    or auth.uid()::text = split_part(name, '/', 1)
  )
);
