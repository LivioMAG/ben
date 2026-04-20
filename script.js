const STORAGE_BUCKET = 'weekly-attachments';
const CRM_NOTE_STORAGE_BUCKET = 'crm-note-attachments';
const CONFIG_PATH = './supabase-config.json';
const HOLIDAY_TABLE = 'platform_holidays';
const NOTES_TABLE = 'notes';
const CRM_NOTE_TYPE = 'crm';
const CRM_NOTE_CATEGORY_DEFAULT = 'information';
const CRM_NOTE_RANKING_DEFAULT = 2;
const WEEKDAY_LABELS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const DISPO_ITEMS_PREFIX = 'dispo_items:';
const DISPO_ITEMS_LEGACY_PREFIX = '__dispo_items__:';
const DISPO_DEFAULT_START_TIME = '07:00';
const DISPO_DEFAULT_END_TIME = '16:30';
const APP_ROLE_OPTIONS = ['Lehrling', 'Elektroinstallateur', 'Bauleiter', 'Projektleiter', 'Service'];
const SCHOOL_DAY_OPTIONS = [
  { value: 1, label: 'Montag' },
  { value: 2, label: 'Dienstag' },
  { value: 3, label: 'Mittwoch' },
  { value: 4, label: 'Donnerstag' },
  { value: 5, label: 'Freitag' },
];
const SCHOOL_REPORT_NOTE_MARKER = 'Automatisch erstellter Berufsschultag';
const BLOCK_DAY_REPORT_NOTE_MARKER = 'Automatisch erstellter Blocktag';
const BLOCK_DAY_TYPE_CODE = 8;
const BLOCK_DAY_DEFAULT_START = '07:00';
const BLOCK_DAY_DEFAULT_END = '16:30';
const BLOCK_DAY_LEGACY_MODE_OPTIONS = {
  full: { label: 'Ganzer Tag', start: '07:00', end: '16:30' },
  am: { label: 'Vormittag', start: '07:00', end: '12:00' },
  pm: { label: 'Nachmittag', start: '13:00', end: '16:30' },
};
const CRM_CATEGORY_LABELS = {
  kunde: 'Kunde',
  lieferant: 'Lieferant',
  elektroplaner: 'Elektroplaner',
  subunternehmer: 'Subunternehmer',
  unternehmer: 'Unternehmer',
};
const HOLIDAY_TYPE_LABELS = {
  ferien: 'Ferien',
  fehlen: 'Ferien',
  militaer: 'Militär',
  zivildienst: 'Zivildienst',
  berufsschule: 'Berufsschule',
  uk: 'Berufsschule',
  'ük': 'Berufsschule',
  unfall: 'Unfall',
  krankheit: 'Krankheit',
  feiertag: 'Feiertag',
  blocktag: 'Blocktag',
};
const ABSENCE_TYPE_CODE_LABELS = {
  1: 'Ferien',
  2: 'Krankheit',
  3: 'Militär',
  4: 'Unfall',
  5: 'Feiertag',
  6: 'ÜK',
  7: 'Berufsschule',
  8: 'Blocktag',
};
const HOLIDAY_REQUEST_TYPE_TO_ABSENCE_TYPE_CODE = {
  ferien: 1,
  fehlen: 1,
  krankheit: 2,
  militaer: 3,
  militar: 3,
  zivildienst: 3,
  unfall: 4,
  feiertag: 5,
  uk: 6,
  'ük': 6,
  berufsschule: 7,
  blocktag: 8,
};
const ABSENCE_CATEGORY_CONFIG = [
  { typeCode: 1, label: 'Ferien' },
  { typeCode: 2, label: 'Krankheit' },
  { typeCode: 3, label: 'Militär' },
  { typeCode: 4, label: 'Unfall' },
  { typeCode: 5, label: 'Feiertag' },
  { typeCode: 6, label: 'ÜK' },
  { typeCode: 7, label: 'Berufsschule' },
  { typeCode: 8, label: 'Blocktag' },
];
const ABSENCE_TYPE_CODES = new Set([1, 2, 3, 4, 5, 6, 7, 8]);
const MAX_VISIBLE_FILTER_OPTIONS = 5;
const BLOCK_SCHEDULE_SCHEMA_HINT =
  "Die Datenbankspalte 'app_profiles.block_schedule' fehlt. Bitte das aktuelle Supabase-Schema (ALTER TABLE app_profiles ADD COLUMN block_schedule ...) ausführen und danach die Seite neu laden.";
const ADMIN_SQL_SNIPPET = `-- Vollzugriff nur für Profile mit is_admin = true

alter table public.holiday_requests
add column if not exists controll_pl text;

alter table public.holiday_requests
add column if not exists controll_gl text;

alter table public.platform_holidays
add column if not exists is_paid boolean not null default true;

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

alter table public.app_profiles
add column if not exists is_active boolean not null default true;

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

alter table public.projects
add column if not exists project_lead_profile_id uuid references public.app_profiles(id) on delete set null;

alter table public.projects
add column if not exists construction_lead_profile_id uuid references public.app_profiles(id) on delete set null;

alter table public.projects
add column if not exists allow_expenses boolean not null default true;

create table if not exists public.school_vacations (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint school_vacations_range_check check (end_date >= start_date)
);

alter table public.app_profiles enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.holiday_requests enable row level security;

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

create table if not exists public.platform_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  label text not null,
  is_paid boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.build_holiday_request_history_text(request_row public.holiday_requests)
returns text
language sql
stable
set search_path = public
as $$
  select trim(
    both ' | ' from concat_ws(
      ' | ',
      case
        when request_row.request_type is not null and request_row.request_type <> '' then
          initcap(replace(request_row.request_type, '_', ' '))
        else null
      end,
      case
        when request_row.start_date is not null and request_row.end_date is not null then
          request_row.start_date::text || ' bis ' || request_row.end_date::text
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

drop policy if exists "authenticated full access app_profiles" on public.app_profiles;
drop policy if exists "authenticated full access weekly_reports" on public.weekly_reports;
drop policy if exists "authenticated full access holiday_requests" on public.holiday_requests;
drop policy if exists "authenticated attachment read" on storage.objects;
drop policy if exists "authenticated attachment write" on storage.objects;
drop policy if exists "app_profiles own or admin" on public.app_profiles;
drop policy if exists "app_profiles insert own or admin" on public.app_profiles;
drop policy if exists "app_profiles update own or admin" on public.app_profiles;
drop policy if exists "app_profiles delete own or admin" on public.app_profiles;
drop policy if exists "weekly_reports own or admin" on public.weekly_reports;
drop policy if exists "holiday_requests own or admin" on public.holiday_requests;
drop policy if exists "weekly attachment read own or admin" on storage.objects;
drop policy if exists "weekly attachment write own or admin" on storage.objects;

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

create policy "weekly attachment read own or admin"
on storage.objects
for select
using (
  bucket_id = '${STORAGE_BUCKET}' and (
    public.is_admin_user() or auth.uid()::text = split_part(name, '/', 1)
  )
);

create policy "weekly attachment write own or admin"
on storage.objects
for all
using (
  bucket_id = '${STORAGE_BUCKET}' and (
    public.is_admin_user() or auth.uid()::text = split_part(name, '/', 1)
  )
)
with check (
  bucket_id = '${STORAGE_BUCKET}' and (
    public.is_admin_user() or auth.uid()::text = split_part(name, '/', 1)
  )
);`;

const demoProfiles = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'admin@maraschow.cn',
    full_name: 'Master Admin',
    role_label: 'Administration',
    is_admin: true,
    is_active: true,
    vacation_allowance_hours: 200,
    booked_vacation_hours: 0,
    carryover_overtime_hours: 0,
    reported_hours: 0,
    credited_hours: 0,
    weekly_hours: 40,
    target_revenue: 0,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'michael@example.com',
    full_name: 'Michael Gerber',
    role_label: 'Monteur',
    is_admin: false,
    is_active: true,
    vacation_allowance_hours: 200,
    booked_vacation_hours: 0,
    carryover_overtime_hours: 0,
    reported_hours: 0,
    credited_hours: 0,
    weekly_hours: 40,
    target_revenue: 0,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'sandra@example.com',
    full_name: 'Sandra Bühler',
    role_label: 'Monteurin',
    is_admin: false,
    is_active: true,
    vacation_allowance_hours: 200,
    booked_vacation_hours: 0,
    carryover_overtime_hours: 0,
    reported_hours: 0,
    credited_hours: 0,
    weekly_hours: 40,
    target_revenue: 0,
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    email: 'pascal@example.com',
    full_name: 'Pascal Frei',
    role_label: 'Monteur',
    is_admin: false,
    is_active: true,
    target_revenue: 0,
  },
];

const demoWeeklyReports = [
  {
    id: crypto.randomUUID(),
    profile_id: '22222222-2222-2222-2222-222222222222',
    work_date: getDateForWeekOffset(0, 0),
    project_name: 'Neubau Bahnhof Bern',
    commission_number: 'K-1024',
    start_time: '07:00',
    end_time: '17:00',
    lunch_break_minutes: 60,
    additional_break_minutes: 15,
    total_work_minutes: 525,
    adjusted_work_minutes: 525,
    expenses_amount: 24.5,
    other_costs_amount: 0,
    expense_note: 'Mittag auf Baustelle',
    notes: 'Leitungen montiert',
    controll: '',
    attachments: [],
  },
  {
    id: crypto.randomUUID(),
    profile_id: '22222222-2222-2222-2222-222222222222',
    work_date: getDateForWeekOffset(0, 1),
    project_name: 'Neubau Bahnhof Bern',
    commission_number: 'K-1024',
    start_time: '07:15',
    end_time: '16:45',
    lunch_break_minutes: 60,
    additional_break_minutes: 15,
    total_work_minutes: 495,
    adjusted_work_minutes: 495,
    expenses_amount: 18,
    other_costs_amount: 0,
    expense_note: 'Spesen',
    notes: 'Abschluss Elektroinstallationen',
    controll: 'Master',
    attachments: [],
  },
  {
    id: crypto.randomUUID(),
    profile_id: '33333333-3333-3333-3333-333333333333',
    work_date: getDateForWeekOffset(0, 0),
    project_name: 'Sanierung Schulhaus Süd',
    commission_number: 'K-2001',
    start_time: '08:00',
    end_time: '16:30',
    lunch_break_minutes: 45,
    additional_break_minutes: 15,
    total_work_minutes: 450,
    adjusted_work_minutes: 450,
    expenses_amount: 12,
    other_costs_amount: 8,
    expense_note: 'Parkhaus',
    notes: 'Serviceeinsatz und Messung',
    controll: '',
    attachments: [],
  },
  {
    id: crypto.randomUUID(),
    profile_id: '33333333-3333-3333-3333-333333333333',
    work_date: getDateForWeekOffset(0, 3),
    project_name: 'Berufsschule',
    commission_number: '',
    start_time: '00:00',
    end_time: '00:00',
    lunch_break_minutes: 0,
    additional_break_minutes: 0,
    total_work_minutes: 0,
    adjusted_work_minutes: 0,
    expenses_amount: 0,
    other_costs_amount: 0,
    expense_note: '',
    notes: 'Ferientag',
    controll: '',
    attachments: [],
  },
];

const demoHolidayRequests = [
  {
    id: crypto.randomUUID(),
    profile_id: '33333333-3333-3333-3333-333333333333',
    start_date: getDateForWeekOffset(0, 3),
    end_date: getDateForWeekOffset(0, 4),
    request_type: 'ferien',
    notes: 'Bereits mit Team abgestimmt.',
    controll_pl: '',
    controll_gl: '',
    attachments: [],
  },
  {
    id: crypto.randomUUID(),
    profile_id: '22222222-2222-2222-2222-222222222222',
    start_date: getDateForWeekOffset(1, 0),
    end_date: getDateForWeekOffset(1, 2),
    request_type: 'militaer',
    notes: 'WK laut Aufgebot.',
    controll_pl: '',
    controll_gl: '',
    attachments: [],
  },
];

const demoRequestHistory = [];
const demoPlatformHolidays = [];

const state = {
  supabase: null,
  session: null,
  user: null,
  currentProfile: null,
  profiles: [],
  weeklyReports: [],
  projects: [],
  roleAssignments: [],
  dailyAssignments: [],
  holidayRequests: [],
  requestHistory: [],
  platformHolidays: [],
  schoolVacations: [],
  crmContacts: [],
  crmNotes: [],
  selectedCrmContactId: null,
  crmSearchQuery: '',
  crmCategoryFilter: '',
  selectedWeek: getCurrentWeekValue(),
  currentPage: 'reports',
  projectSearchQuery: '',
  editingProjectId: null,
  isSavingProject: false,
  isSavingDispo: false,
  dispoAssignContext: null,
  dispoAllowMultiplePerDay: true,
  selectedProjectId: null,
  employeeFilterQuery: '',
  selectedEmployeeIds: [],
  employeeSelectionInitialized: false,
  employeeSelectionTouched: false,
  showControlledReports: false,
  absenceFilterQuery: '',
  selectedAbsenceEmployeeIds: [],
  absenceSelectionInitialized: false,
  absenceSelectionTouched: false,
  showControlledAbsences: false,
  includeConfirmationHistory: false,
  isConfirmationsModalOpen: false,
  reportsPage: 1,
  reportsPerPage: 20,
  editingReportId: null,
  editingReportPauseMinutes: 0,
  isSavingReport: false,
  isDemoMode: false,
  hasAdminAccess: false,
  isAdminStatusResolved: false,
  configReady: false,
  authListenerBound: false,
  isLoadingData: false,
  isSavingAbsence: false,
  isSavingConfirmation: false,
  isSavingSaldo: false,
  isSavingSettings: false,
  editingHolidayId: null,
  isLoadingOverlayVisible: false,
  loadingOverlayReason: '',
  loadingOverlayTimer: null,
  loadingTaskDepth: 0,
  editingAdjustedReportId: null,
  loadRequestId: 0,
  loadStartedAt: 0,
  tabHiddenAt: 0,
  loadRecoveryTimer: null,
  lastResumeRefreshAt: 0,
  pendingDataReload: false,
};

const elements = {};
const STALE_LOADING_TIMEOUT_MS = 4000;
const LOAD_WATCHDOG_TIMEOUT_MS = 10000;
const LONG_TASK_OVERLAY_DELAY_MS = 550;
const RESUME_REFRESH_COOLDOWN_MS = 1500;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  cacheElements();
  bindEvents();
  elements.weekPicker.value = state.selectedWeek;
  if (elements.adminSqlPreview) {
    elements.adminSqlPreview.textContent = ADMIN_SQL_SNIPPET;
  }

  await initializeSupabase();
  await bootstrapSession();
  render();
}

function cacheElements() {
  elements.loginView = document.getElementById('loginView');
  elements.appView = document.getElementById('appView');
  elements.accessDeniedView = document.getElementById('accessDeniedView');
  elements.accessDeniedLogoutButton = document.getElementById('accessDeniedLogoutButton');
  elements.loginForm = document.getElementById('loginForm');
  elements.emailInput = document.getElementById('emailInput');
  elements.passwordInput = document.getElementById('passwordInput');
  elements.loginAlert = document.getElementById('loginAlert');
  elements.userName = document.getElementById('userName');
  elements.userRole = document.getElementById('userRole');
  elements.userBadge = document.getElementById('userBadge');
  elements.connectionBadge = document.getElementById('connectionBadge');
  elements.dataTimestamp = document.getElementById('dataTimestamp');
  elements.pageTitle = document.getElementById('pageTitle');
  elements.weekPicker = document.getElementById('weekPicker');
  elements.weekLabel = document.getElementById('weekLabel');
  elements.weekDateRange = document.getElementById('weekDateRange');
  elements.previousWeekButton = document.getElementById('previousWeekButton');
  elements.nextWeekButton = document.getElementById('nextWeekButton');
  elements.exportPdfButton = document.getElementById('exportPdfButton');
  elements.reportStatusButton = document.getElementById('reportStatusButton');
  elements.reportStatusIcon = document.getElementById('reportStatusIcon');
  elements.reportStatusText = document.getElementById('reportStatusText');
  elements.connectionRefreshButton = document.getElementById('connectionRefreshButton');
  elements.logoutButton = document.getElementById('logoutButton');
  elements.reportsTableBody = document.getElementById('reportsTableBody');
  elements.absencesTableBody = document.getElementById('absencesTableBody');
  elements.confirmationsTableBody = document.getElementById('confirmationsTableBody');
  elements.saldoTableBody = document.getElementById('saldoTableBody');
  elements.missingReports = document.getElementById('missingReports');
  elements.submissionList = document.getElementById('submissionList');
  elements.missingList = document.getElementById('missingList');
  elements.selectedEmployeesSummary = document.getElementById('selectedEmployeesSummary');
  elements.employeeFilterInput = document.getElementById('employeeFilterInput');
  elements.employeeFilterList = document.getElementById('employeeFilterList');
  elements.selectAllEmployeesButton = document.getElementById('selectAllEmployeesButton');
  elements.clearEmployeeSelectionButton = document.getElementById('clearEmployeeSelectionButton');
  elements.showControlledReportsInput = document.getElementById('showControlledReportsInput');
  elements.selectedAbsenceEmployeesSummary = document.getElementById('selectedAbsenceEmployeesSummary');
  elements.absenceFilterInput = document.getElementById('absenceFilterInput');
  elements.absenceFilterList = document.getElementById('absenceFilterList');
  elements.selectAllAbsenceEmployeesButton = document.getElementById('selectAllAbsenceEmployeesButton');
  elements.clearAbsenceSelectionButton = document.getElementById('clearAbsenceSelectionButton');
  elements.showControlledAbsencesInput = document.getElementById('showControlledAbsencesInput');
  elements.openConfirmationsModalButton = document.getElementById('openConfirmationsModalButton');
  elements.confirmationsModal = document.getElementById('confirmationsModal');
  elements.closeConfirmationsModalButton = document.getElementById('closeConfirmationsModalButton');
  elements.includeConfirmationHistoryInput = document.getElementById('includeConfirmationHistoryInput');
  elements.exportConfirmationsPdfButton = document.getElementById('exportConfirmationsPdfButton');
  elements.reportsPrevPageButton = document.getElementById('reportsPrevPageButton');
  elements.reportsNextPageButton = document.getElementById('reportsNextPageButton');
  elements.reportsPaginationSummary = document.getElementById('reportsPaginationSummary');
  elements.reportEditModal = document.getElementById('reportEditModal');
  elements.reportEditForm = document.getElementById('reportEditForm');
  elements.closeReportEditModalButton = document.getElementById('closeReportEditModalButton');
  elements.cancelReportEditButton = document.getElementById('cancelReportEditButton');
  elements.editReportId = document.getElementById('editReportId');
  elements.editEmployeeName = document.getElementById('editEmployeeName');
  elements.editWorkDate = document.getElementById('editWorkDate');
  elements.editCommissionNumber = document.getElementById('editCommissionNumber');
  elements.editStartTime = document.getElementById('editStartTime');
  elements.editEndTime = document.getElementById('editEndTime');
  elements.editTotalMinutes = document.getElementById('editTotalMinutes');
  elements.editPauseMinutes = document.getElementById('editPauseMinutes');
  elements.editExpensesAmount = document.getElementById('editExpensesAmount');
  elements.editOtherCostsAmount = document.getElementById('editOtherCostsAmount');
  elements.editNotes = document.getElementById('editNotes');
  elements.reportEditAttachments = document.getElementById('reportEditAttachments');
  elements.adjustedMinutesModal = document.getElementById('adjustedMinutesModal');
  elements.adjustedMinutesForm = document.getElementById('adjustedMinutesForm');
  elements.adjustedReportId = document.getElementById('adjustedReportId');
  elements.adjustedMinutesInput = document.getElementById('adjustedMinutesInput');
  elements.closeAdjustedMinutesModalButton = document.getElementById('closeAdjustedMinutesModalButton');
  elements.cancelAdjustedMinutesButton = document.getElementById('cancelAdjustedMinutesButton');
  elements.loadingOverlay = document.getElementById('loadingOverlay');
  elements.loadingOverlayText = document.getElementById('loadingOverlayText');
  elements.pages = {
    reports: document.getElementById('reportsPage'),
    absences: document.getElementById('absencesPage'),
    saldo: document.getElementById('saldoPage'),
    projects: document.getElementById('projectsPage'),
    projectDetail: document.getElementById('projectDetailPage'),
    dispo: document.getElementById('dispoPage'),
    crm: document.getElementById('crmPage'),
    settings: document.getElementById('settingsPage'),
  };
  elements.projectForm = document.getElementById('projectForm');
  elements.projectIdInput = document.getElementById('projectIdInput');
  elements.projectCommissionInput = document.getElementById('projectCommissionInput');
  elements.projectNameInput = document.getElementById('projectNameInput');
  elements.projectLeadSelect = document.getElementById('projectLeadSelect');
  elements.constructionLeadSelect = document.getElementById('constructionLeadSelect');
  elements.projectExpensesAllowedInput = document.getElementById('projectExpensesAllowedInput');
  elements.projectSearchInput = document.getElementById('projectSearchInput');
  elements.projectsTableBody = document.getElementById('projectsTableBody');
  elements.projectsAlert = document.getElementById('projectsAlert');
  elements.openProjectModalButton = document.getElementById('openProjectModalButton');
  elements.resetProjectFormButton = document.getElementById('resetProjectFormButton');
  elements.projectModal = document.getElementById('projectModal');
  elements.closeProjectModalButton = document.getElementById('closeProjectModalButton');
  elements.backToProjectsButton = document.getElementById('backToProjectsButton');
  elements.projectDetailTitle = document.getElementById('projectDetailTitle');
  elements.dispoAlert = document.getElementById('dispoAlert');
  elements.dispoPreviousWeekButton = document.getElementById('dispoPreviousWeekButton');
  elements.dispoNextWeekButton = document.getElementById('dispoNextWeekButton');
  elements.dispoWeekLabel = document.getElementById('dispoWeekLabel');
  elements.dispoWeekDateRange = document.getElementById('dispoWeekDateRange');
  elements.dispoTableHead = document.getElementById('dispoTableHead');
  elements.dispoTableBody = document.getElementById('dispoTableBody');
  elements.dispoExportPdfButton = document.getElementById('dispoExportPdfButton');
  elements.dispoGapSearchButton = document.getElementById('dispoGapSearchButton');
  elements.dispoGapResults = document.getElementById('dispoGapResults');
  elements.dispoGapSearchModal = document.getElementById('dispoGapSearchModal');
  elements.dispoGapSearchForm = document.getElementById('dispoGapSearchForm');
  elements.dispoGapWeekFromInput = document.getElementById('dispoGapWeekFromInput');
  elements.dispoGapWeekToInput = document.getElementById('dispoGapWeekToInput');
  elements.dispoGapMinimumHoursInput = document.getElementById('dispoGapMinimumHoursInput');
  elements.dispoGapServiceProfiles = document.getElementById('dispoGapServiceProfiles');
  elements.dispoGapModalResults = document.getElementById('dispoGapModalResults');
  elements.closeDispoGapSearchModalButton = document.getElementById('closeDispoGapSearchModalButton');
  elements.cancelDispoGapSearchButton = document.getElementById('cancelDispoGapSearchButton');
  elements.dispoMultiEntryInput = document.getElementById('dispoMultiEntryInput');
  elements.dispoAssignModal = document.getElementById('dispoAssignModal');
  elements.dispoAssignForm = document.getElementById('dispoAssignForm');
  elements.dispoAssignTargetLabel = document.getElementById('dispoAssignTargetLabel');
  elements.dispoAssignProjectsList = document.getElementById('dispoAssignProjectsList');
  elements.dispoAssignSpecialList = document.getElementById('dispoAssignSpecialList');
  elements.dispoAssignStartTime = document.getElementById('dispoAssignStartTime');
  elements.dispoAssignEndTime = document.getElementById('dispoAssignEndTime');
  elements.closeDispoAssignModalButton = document.getElementById('closeDispoAssignModalButton');
  elements.cancelDispoAssignButton = document.getElementById('cancelDispoAssignButton');
  elements.navTabs = Array.from(document.querySelectorAll('.nav-tab'));
  elements.adminSqlPreview = document.getElementById('adminSqlPreview');
  elements.settingsUsersTableBody = document.getElementById('settingsUsersTableBody');
  elements.settingsHolidaysTableBody = document.getElementById('settingsHolidaysTableBody');
  elements.settingsSchoolVacationsTableBody = document.getElementById('settingsSchoolVacationsTableBody');
  elements.holidayForm = document.getElementById('holidayForm');
  elements.holidayDateInput = document.getElementById('holidayDateInput');
  elements.holidayNameInput = document.getElementById('holidayNameInput');
  elements.holidayIsPaidInput = document.getElementById('holidayIsPaidInput');
  elements.saveHolidayButton = document.getElementById('saveHolidayButton');
  elements.schoolVacationForm = document.getElementById('schoolVacationForm');
  elements.schoolVacationStartInput = document.getElementById('schoolVacationStartInput');
  elements.schoolVacationEndInput = document.getElementById('schoolVacationEndInput');
  elements.blockDayModal = document.getElementById('blockDayModal');
  elements.blockDayForm = document.getElementById('blockDayForm');
  elements.blockDayProfileIdInput = document.getElementById('blockDayProfileIdInput');
  elements.blockDayYearInput = document.getElementById('blockDayYearInput');
  elements.blockDayOptionsBody = document.getElementById('blockDayOptionsBody');
  elements.closeBlockDayModalButton = document.getElementById('closeBlockDayModalButton');
  elements.cancelBlockDayButton = document.getElementById('cancelBlockDayButton');
  elements.crmAlert = document.getElementById('crmAlert');
  elements.crmSearchInput = document.getElementById('crmSearchInput');
  elements.crmCategoryFilterInput = document.getElementById('crmCategoryFilterInput');
  elements.openCrmCreateModalButton = document.getElementById('openCrmCreateModalButton');
  elements.crmContactListView = document.getElementById('crmContactListView');
  elements.crmContactDetailView = document.getElementById('crmContactDetailView');
  elements.backToCrmListButton = document.getElementById('backToCrmListButton');
  elements.crmContactDetailInfo = document.getElementById('crmContactDetailInfo');
  elements.crmContactModal = document.getElementById('crmContactModal');
  elements.closeCrmContactModalButton = document.getElementById('closeCrmContactModalButton');
  elements.crmContactForm = document.getElementById('crmContactForm');
  elements.crmContactIdInput = document.getElementById('crmContactIdInput');
  elements.crmCategoryInput = document.getElementById('crmCategoryInput');
  elements.crmCompanyInput = document.getElementById('crmCompanyInput');
  elements.crmFirstNameInput = document.getElementById('crmFirstNameInput');
  elements.crmLastNameInput = document.getElementById('crmLastNameInput');
  elements.crmStreetInput = document.getElementById('crmStreetInput');
  elements.crmCityInput = document.getElementById('crmCityInput');
  elements.crmPostalCodeInput = document.getElementById('crmPostalCodeInput');
  elements.crmPhoneInput = document.getElementById('crmPhoneInput');
  elements.crmEmailInput = document.getElementById('crmEmailInput');
  elements.saveCrmContactButton = document.getElementById('saveCrmContactButton');
  elements.resetCrmContactFormButton = document.getElementById('resetCrmContactFormButton');
  elements.crmContactsTableBody = document.getElementById('crmContactsTableBody');
  elements.crmNotesHeader = document.getElementById('crmNotesHeader');
  elements.crmNoteForm = document.getElementById('crmNoteForm');
  elements.crmNoteTargetUidInput = document.getElementById('crmNoteTargetUidInput');
  elements.crmNoteTextInput = document.getElementById('crmNoteTextInput');
  elements.crmNotesList = document.getElementById('crmNotesList');
}

function bindEvents() {
  elements.loginForm.addEventListener('submit', handleLogin);
  elements.logoutButton.addEventListener('click', handleLogout);
  elements.accessDeniedLogoutButton.addEventListener('click', handleLogout);
  elements.connectionRefreshButton.addEventListener('click', refreshData);
  elements.weekPicker.addEventListener('change', async (event) => {
    state.selectedWeek = event.target.value;
    await loadData();
  });
  elements.previousWeekButton.addEventListener('click', async () => {
    state.selectedWeek = shiftWeekValue(state.selectedWeek, -1);
    elements.weekPicker.value = state.selectedWeek;
    await loadData();
  });
  elements.nextWeekButton.addEventListener('click', async () => {
    state.selectedWeek = shiftWeekValue(state.selectedWeek, 1);
    elements.weekPicker.value = state.selectedWeek;
    await loadData();
  });
  elements.exportPdfButton.addEventListener('click', exportWeekPdf);
  elements.employeeFilterInput.addEventListener('input', handleEmployeeFilterInput);
  elements.selectAllEmployeesButton.addEventListener('click', selectAllEmployees);
  elements.clearEmployeeSelectionButton.addEventListener('click', clearEmployeeSelection);
  elements.showControlledReportsInput.addEventListener('change', handleShowControlledReportsToggle);
  elements.employeeFilterList.addEventListener('change', handleEmployeeSelectionChange);
  if (elements.absenceFilterInput) elements.absenceFilterInput.addEventListener('input', handleAbsenceFilterInput);
  if (elements.selectAllAbsenceEmployeesButton) elements.selectAllAbsenceEmployeesButton.addEventListener('click', selectAllAbsenceEmployees);
  if (elements.clearAbsenceSelectionButton) elements.clearAbsenceSelectionButton.addEventListener('click', clearAbsenceSelection);
  if (elements.showControlledAbsencesInput) elements.showControlledAbsencesInput.addEventListener('change', handleShowControlledAbsencesToggle);
  if (elements.absenceFilterList) elements.absenceFilterList.addEventListener('change', handleAbsenceSelectionChange);
  elements.openConfirmationsModalButton.addEventListener('click', openConfirmationsModal);
  elements.closeConfirmationsModalButton.addEventListener('click', closeConfirmationsModal);
  elements.includeConfirmationHistoryInput.addEventListener('change', handleConfirmationHistoryToggle);
  elements.exportConfirmationsPdfButton.addEventListener('click', exportFilteredConfirmationsPdf);
  elements.reportsTableBody.addEventListener('click', handleReportsTableClick);
  elements.absencesTableBody.addEventListener('click', handleAbsencesTableClick);
  elements.confirmationsTableBody.addEventListener('click', handleConfirmationsTableClick);
  elements.saldoTableBody.addEventListener('click', handleSaldoTableClick);
  elements.reportsPrevPageButton.addEventListener('click', goToPreviousReportsPage);
  elements.reportsNextPageButton.addEventListener('click', goToNextReportsPage);
  elements.closeReportEditModalButton.addEventListener('click', closeReportEditModal);
  elements.cancelReportEditButton.addEventListener('click', closeReportEditModal);
  elements.reportEditForm.addEventListener('submit', handleReportEditSubmit);
  elements.editStartTime.addEventListener('change', syncEditedWorkMinutesWithTimeRange);
  elements.editEndTime.addEventListener('change', syncEditedWorkMinutesWithTimeRange);
  elements.editStartTime.addEventListener('input', syncEditedWorkMinutesWithTimeRange);
  elements.editEndTime.addEventListener('input', syncEditedWorkMinutesWithTimeRange);
  elements.editPauseMinutes.addEventListener('change', syncEditedWorkMinutesWithTimeRange);
  elements.editPauseMinutes.addEventListener('input', syncEditedWorkMinutesWithTimeRange);
  elements.adjustedMinutesForm.addEventListener('submit', handleAdjustedMinutesSubmit);
  elements.reportEditModal.addEventListener('click', (event) => {
    if (event.target?.dataset?.closeModal === 'true') {
      closeReportEditModal();
    }
  });
  elements.closeAdjustedMinutesModalButton.addEventListener('click', closeAdjustedMinutesModal);
  elements.cancelAdjustedMinutesButton.addEventListener('click', closeAdjustedMinutesModal);
  elements.adjustedMinutesModal.addEventListener('click', (event) => {
    if (event.target?.dataset?.closeAdjustedModal === 'true') {
      closeAdjustedMinutesModal();
    }
  });
  elements.projectForm.addEventListener('submit', handleProjectSubmit);
  elements.projectSearchInput.addEventListener('input', handleProjectSearchInput);
  elements.projectsTableBody.addEventListener('click', handleProjectsTableClick);
  elements.resetProjectFormButton.addEventListener('click', resetProjectForm);
  elements.openProjectModalButton.addEventListener('click', () => openProjectModal());
  elements.closeProjectModalButton.addEventListener('click', closeProjectModal);
  elements.projectModal.addEventListener('click', (event) => {
    if (event.target?.dataset?.closeProjectModal === 'true') {
      closeProjectModal();
    }
  });
  elements.backToProjectsButton.addEventListener('click', () => setCurrentPage('projects'));
  elements.dispoTableBody.addEventListener('click', handleDispoTableClick);
  elements.dispoTableHead.addEventListener('click', handleDispoTableClick);
  elements.dispoExportPdfButton.addEventListener('click', exportDispoPdf);
  elements.dispoGapSearchButton.addEventListener('click', openDispoGapSearchModal);
  if (elements.dispoGapSearchForm) {
    elements.dispoGapSearchForm.addEventListener('submit', handleDispoGapSearchSubmit);
  }
  if (elements.closeDispoGapSearchModalButton) {
    elements.closeDispoGapSearchModalButton.addEventListener('click', closeDispoGapSearchModal);
  }
  if (elements.cancelDispoGapSearchButton) {
    elements.cancelDispoGapSearchButton.addEventListener('click', closeDispoGapSearchModal);
  }
  if (elements.dispoGapSearchModal) {
    elements.dispoGapSearchModal.addEventListener('click', (event) => {
      if (event.target?.dataset?.closeDispoGapSearchModal === 'true') {
        closeDispoGapSearchModal();
      }
    });
  }
  elements.dispoMultiEntryInput.addEventListener('change', handleDispoMultiEntryToggle);
  elements.dispoAssignForm.addEventListener('submit', handleDispoAssignSubmit);
  elements.closeDispoAssignModalButton.addEventListener('click', closeDispoAssignModal);
  elements.cancelDispoAssignButton.addEventListener('click', closeDispoAssignModal);
  elements.dispoAssignModal.addEventListener('click', (event) => {
    if (event.target?.dataset?.closeDispoAssignModal === 'true') {
      closeDispoAssignModal();
    }
  });
  elements.confirmationsModal.addEventListener('click', (event) => {
    if (event.target?.dataset?.closeConfirmationsModal === 'true') {
      closeConfirmationsModal();
    }
  });
  elements.dispoPreviousWeekButton.addEventListener('click', async () => {
    state.selectedWeek = shiftWeekValue(state.selectedWeek, -1);
    elements.weekPicker.value = state.selectedWeek;
    await loadData();
  });
  elements.dispoNextWeekButton.addEventListener('click', async () => {
    state.selectedWeek = shiftWeekValue(state.selectedWeek, 1);
    elements.weekPicker.value = state.selectedWeek;
    await loadData();
  });
  if (elements.settingsUsersTableBody) {
    elements.settingsUsersTableBody.addEventListener('click', handleSettingsUsersTableClick);
    elements.settingsUsersTableBody.addEventListener('change', handleSettingsUsersTableChange);
  }
  if (elements.settingsHolidaysTableBody) {
    elements.settingsHolidaysTableBody.addEventListener('click', handleSettingsHolidaysTableClick);
  }
  if (elements.holidayForm) {
    elements.holidayForm.addEventListener('submit', handleHolidayFormSubmit);
  }
  if (elements.settingsSchoolVacationsTableBody) {
    elements.settingsSchoolVacationsTableBody.addEventListener('click', handleSettingsSchoolVacationsTableClick);
  }
  if (elements.schoolVacationForm) {
    elements.schoolVacationForm.addEventListener('submit', handleSchoolVacationFormSubmit);
  }
  if (elements.blockDayForm) {
    elements.blockDayForm.addEventListener('submit', handleBlockDayFormSubmit);
  }
  if (elements.closeBlockDayModalButton) {
    elements.closeBlockDayModalButton.addEventListener('click', closeBlockDayModal);
  }
  if (elements.cancelBlockDayButton) {
    elements.cancelBlockDayButton.addEventListener('click', closeBlockDayModal);
  }
  if (elements.blockDayModal) {
    elements.blockDayModal.addEventListener('click', (event) => {
      if (event.target?.dataset?.closeBlockDayModal === 'true') {
        closeBlockDayModal();
      }
    });
  }
  if (elements.crmContactForm) {
    elements.crmContactForm.addEventListener('submit', handleCrmContactSubmit);
  }
  if (elements.crmSearchInput) {
    elements.crmSearchInput.addEventListener('input', handleCrmSearchInput);
  }
  if (elements.crmCategoryFilterInput) {
    elements.crmCategoryFilterInput.addEventListener('change', handleCrmCategoryFilterChange);
  }
  if (elements.openCrmCreateModalButton) {
    elements.openCrmCreateModalButton.addEventListener('click', () => openCrmContactModal());
  }
  if (elements.backToCrmListButton) {
    elements.backToCrmListButton.addEventListener('click', closeCrmContactDetail);
  }
  if (elements.resetCrmContactFormButton) {
    elements.resetCrmContactFormButton.addEventListener('click', resetCrmContactForm);
  }
  if (elements.closeCrmContactModalButton) {
    elements.closeCrmContactModalButton.addEventListener('click', closeCrmContactModal);
  }
  if (elements.crmContactsTableBody) {
    elements.crmContactsTableBody.addEventListener('click', handleCrmContactsTableClick);
  }
  if (elements.crmNoteForm) {
    elements.crmNoteForm.addEventListener('submit', handleCrmNoteSubmit);
  }
  if (elements.crmContactModal) {
    elements.crmContactModal.addEventListener('click', (event) => {
      if (event.target?.dataset?.closeCrmContactModal === 'true') {
        closeCrmContactModal();
      }
    });
  }
  document.addEventListener('keydown', handleGlobalKeydown);
  window.addEventListener('focus', handleWindowFocus);
  window.addEventListener('pageshow', handleWindowFocus);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  elements.navTabs.forEach((tab) => {
    tab.addEventListener('click', () => setCurrentPage(tab.dataset.page));
  });
}

async function initializeSupabase() {
  if (!window.supabase?.createClient) {
    setConnectionBadge('Supabase SDK fehlt', true);
    return;
  }

  try {
    const response = await fetch(CONFIG_PATH, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Konfigurationsdatei nicht gefunden. Demo-Modus aktiv.');
    }

    const config = await response.json();
    if (!config?.supabaseUrl || !config?.supabaseAnonKey) {
      throw new Error('supabase-config.json ist unvollständig. Demo-Modus aktiv.');
    }

    state.supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    state.configReady = true;
    setConnectionBadge('Verbunden');
  } catch (error) {
    console.warn(error);
    state.isDemoMode = true;
    setConnectionBadge('Demo-Modus', true);
    showLoginMessage(`${error.message} Mit Demo-Daten kann das UI trotzdem geprüft werden.`, false);
  }
}

async function bootstrapSession() {
  if (state.isDemoMode) {
    return;
  }

  const { data, error } = await state.supabase.auth.getSession();
  if (error) {
    showLoginMessage(error.message);
    return;
  }

  state.session = data.session;
  if (state.session?.user) {
    state.user = state.session.user;
    state.hasAdminAccess = false;
    state.isAdminStatusResolved = false;
    await loadData();
  }

  if (!state.authListenerBound) {
    state.authListenerBound = true;
    state.supabase.auth.onAuthStateChange(async (event, session) => {
      state.session = session;

      if (event === 'SIGNED_OUT') {
        resetAppState();
        render();
        return;
      }

      if (!session?.user) {
        return;
      }

      const nextUserId = session.user.id;
      const currentUserId = state.user?.id ?? null;
      const shouldRefreshUserData = ['SIGNED_IN', 'USER_UPDATED'].includes(event);
      const isSessionRecoveryEvent = ['INITIAL_SESSION', 'TOKEN_REFRESHED'].includes(event);

      state.user = session.user;
      state.isAdminStatusResolved = false;

      if (shouldRefreshUserData || (isSessionRecoveryEvent && currentUserId !== nextUserId)) {
        await loadData();
      }
    });
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const email = elements.emailInput.value.trim().toLowerCase();
  const password = elements.passwordInput.value;

  if (state.isDemoMode) {
    const demoProfile = demoProfiles.find((profile) => profile.email === email) ?? demoProfiles[0];
    state.user = { id: demoProfile.id, email: demoProfile.email };
    state.currentProfile = demoProfile;
    state.hasAdminAccess = isAdminProfile(demoProfile);
    state.isAdminStatusResolved = true;
    await loadDemoData();
    showLoginMessage('Demo-Login erfolgreich.', false);
    render();
    return;
  }

  const { data, error } = await state.supabase.auth.signInWithPassword({ email, password });
  if (error) {
    showLoginMessage(error.message);
    return;
  }

  state.session = data.session;
  state.user = data.user;
  state.hasAdminAccess = false;
  state.isAdminStatusResolved = false;
  await loadData();
  showLoginMessage('Login erfolgreich.', false);
  render();
}

async function handleLogout() {
  if (state.isDemoMode) {
    resetAppState();
    showLoginMessage('Demo-Sitzung beendet.', false);
    render();
    return;
  }

  const { error } = await state.supabase.auth.signOut();
  if (error) {
    alert(error.message);
    return;
  }

  resetAppState();
  render();
}

async function refreshData() {
  await loadData();
}

function clearLoadRecoveryTimer() {
  if (state.loadRecoveryTimer) {
    window.clearTimeout(state.loadRecoveryTimer);
    state.loadRecoveryTimer = null;
  }
}

function clearLoadingState() {
  state.loadRequestId += 1;
  state.isLoadingData = false;
  state.loadStartedAt = 0;
  clearLoadRecoveryTimer();
}

function recoverInteractionState({ forceReload = false } = {}) {
  if (!state.isLoadingData) {
    return;
  }

  const loadingDuration = state.loadStartedAt ? Date.now() - state.loadStartedAt : 0;
  if (!forceReload && loadingDuration < STALE_LOADING_TIMEOUT_MS) {
    return;
  }

  clearLoadingState();
  render();

  if (state.user) {
    loadData().catch((error) => {
      console.error(error);
    });
  }
}

function triggerResumeRefresh() {
  if (!state.user || state.isLoadingData) {
    return;
  }

  const now = Date.now();
  if (now - state.lastResumeRefreshAt < RESUME_REFRESH_COOLDOWN_MS) {
    return;
  }

  state.lastResumeRefreshAt = now;
  loadData().catch((error) => {
    console.error(error);
  });
}

function handleWindowFocus() {
  const tabWasHidden = state.tabHiddenAt > 0;
  state.tabHiddenAt = 0;
  recoverInteractionState({ forceReload: tabWasHidden });
  if (tabWasHidden) {
    triggerResumeRefresh();
  }
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    state.tabHiddenAt = Date.now();
    return;
  }

  if (document.visibilityState === 'visible') {
    recoverInteractionState({ forceReload: true });
    triggerResumeRefresh();
  }
}

function beginDataLoad() {
  clearLoadRecoveryTimer();
  state.isLoadingData = true;
  state.loadStartedAt = Date.now();
  const requestId = ++state.loadRequestId;
  state.loadRecoveryTimer = window.setTimeout(() => {
    if (!isActiveDataLoad(requestId) || !state.isLoadingData) {
      return;
    }

    recoverInteractionState({ forceReload: true });
  }, LOAD_WATCHDOG_TIMEOUT_MS);
  render();
  return requestId;
}

function isActiveDataLoad(requestId) {
  return requestId === state.loadRequestId;
}

function finishDataLoad(requestId) {
  if (!isActiveDataLoad(requestId)) {
    return false;
  }

  state.isLoadingData = false;
  state.loadStartedAt = 0;
  clearLoadRecoveryTimer();
  return true;
}

function resetAppState() {
  state.session = null;
  state.user = null;
  state.currentProfile = null;
  state.profiles = [];
  state.weeklyReports = [];
  state.projects = [];
  state.roleAssignments = [];
  state.dailyAssignments = [];
  state.holidayRequests = [];
  state.requestHistory = [];
  state.platformHolidays = [];
  state.schoolVacations = [];
  state.crmContacts = [];
  state.crmNotes = [];
  state.selectedCrmContactId = null;
  state.employeeFilterQuery = '';
  state.projectSearchQuery = '';
  state.editingProjectId = null;
  state.selectedEmployeeIds = [];
  state.employeeSelectionInitialized = false;
  state.employeeSelectionTouched = false;
  state.showControlledReports = false;
  state.absenceFilterQuery = '';
  state.selectedAbsenceEmployeeIds = [];
  state.absenceSelectionInitialized = false;
  state.absenceSelectionTouched = false;
  state.showControlledAbsences = false;
  state.reportsPage = 1;
  state.selectedProjectId = null;
  state.dispoAllowMultiplePerDay = true;
  state.includeConfirmationHistory = false;
  state.isConfirmationsModalOpen = false;
  state.editingReportId = null;
  state.isSavingReport = false;
  state.isSavingProject = false;
  state.isSavingDispo = false;
  state.isSavingSettings = false;
  state.hasAdminAccess = false;
  state.isAdminStatusResolved = false;
  state.isLoadingData = false;
  state.loadRequestId = 0;
  state.loadStartedAt = 0;
  state.tabHiddenAt = 0;
  state.lastResumeRefreshAt = 0;
  state.pendingDataReload = false;
  clearLoadRecoveryTimer();
  closeReportEditModal();
  closeAdjustedMinutesModal();
  elements.dataTimestamp.textContent = 'Noch keine Daten geladen';
}

async function loadData() {
  if (!state.user) {
    render();
    return;
  }

  if (state.isLoadingData) {
    state.pendingDataReload = true;
    return;
  }

  state.pendingDataReload = false;

  const shouldResolveAdminStatus = !state.currentProfile || state.currentProfile.id !== state.user.id;
  if (shouldResolveAdminStatus) {
    state.isAdminStatusResolved = false;
  }

  const requestId = beginDataLoad();

  if (state.isDemoMode) {
    await loadDemoData();
    if (!finishDataLoad(requestId)) {
      return;
    }
    render();
    return;
  }

  try {
    const currentProfile = await fetchCurrentProfile();
    if (!isActiveDataLoad(requestId)) {
      return;
    }
    state.currentProfile = currentProfile ?? buildFallbackProfileFromUser(state.user);
    state.hasAdminAccess = isAdminProfile(state.currentProfile);
    state.isAdminStatusResolved = true;

    if (!state.hasAdminAccess) {
      state.profiles = [];
      state.weeklyReports = [];
      state.projects = [];
      state.roleAssignments = [];
      state.dailyAssignments = [];
      state.holidayRequests = [];
      state.requestHistory = [];
      state.platformHolidays = [];
      state.schoolVacations = [];
      state.crmContacts = [];
      state.crmNotes = [];
      state.selectedCrmContactId = null;
      elements.dataTimestamp.textContent = 'Kein Zugriff – is_admin ist für dieses Profil nicht aktiviert';
      finishDataLoad(requestId);
      render();
      if (state.pendingDataReload) {
        state.pendingDataReload = false;
        loadData().catch((error) => {
          console.error(error);
        });
      }
      return;
    }

    const { year: selectedYear, kw: selectedKw } = getYearAndWeekFromWeekValue(state.selectedWeek);
    const selectedWeekRange = getWeekRange(state.selectedWeek);
    const reportsQuery = state.supabase
      .from('weekly_reports')
      .select('*')
      .eq('year', selectedYear)
      .eq('kw', selectedKw)
      .order('work_date', { ascending: true })
      .order('start_time', { ascending: true });

    const profilesQuery = fetchProfiles();
    const absencesQuery = state.supabase
      .from('holiday_requests')
      .select('*')
      .order('start_date', { ascending: false })
      .limit(200);
    const requestHistoryQuery = state.supabase
      .from('request_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    const projectsQuery = state.supabase
      .from('projects')
      .select('*')
      .order('commission_number', { ascending: true });
    const dailyAssignmentsQuery = state.supabase
      .from('daily_assignments')
      .select('*')
      .gte('assignment_date', selectedWeekRange.start)
      .lte('assignment_date', selectedWeekRange.end)
      .order('assignment_date', { ascending: true });
    const platformHolidaysQuery = state.supabase
      .from(HOLIDAY_TABLE)
      .select('*')
      .order('holiday_date', { ascending: true });
    const schoolVacationsQuery = state.supabase
      .from('school_vacations')
      .select('*')
      .order('start_date', { ascending: true });
    const crmContactsQuery = state.supabase
      .from('crm_contacts')
      .select('*')
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });
    const crmNotesQuery = state.supabase
      .from(NOTES_TABLE)
      .select('*')
      .eq('note_type', CRM_NOTE_TYPE)
      .order('created_at', { ascending: false })
      .limit(1000);
    const [
      { data: reports, error: reportsError },
      { data: profiles, error: profilesError },
      { data: absences, error: absencesError },
      { data: requestHistory, error: requestHistoryError },
      { data: projects, error: projectsError },
      { data: dailyAssignments, error: dailyAssignmentsError },
      { data: platformHolidays, error: platformHolidaysError },
      { data: schoolVacations, error: schoolVacationsError },
      { data: crmContacts, error: crmContactsError },
      { data: crmNotes, error: crmNotesError },
    ] = await Promise.all([
      reportsQuery,
      profilesQuery,
      absencesQuery,
      requestHistoryQuery,
      projectsQuery,
      dailyAssignmentsQuery,
      platformHolidaysQuery,
      schoolVacationsQuery,
      crmContactsQuery,
      crmNotesQuery,
    ]);

    if (reportsError) throw reportsError;
    if (profilesError) throw profilesError;
    if (absencesError) throw absencesError;
    if (requestHistoryError) throw requestHistoryError;
    if (projectsError) throw projectsError;
    if (dailyAssignmentsError && !isMissingTableError(dailyAssignmentsError, 'daily_assignments')) throw dailyAssignmentsError;
    if (platformHolidaysError && !isMissingTableError(platformHolidaysError, HOLIDAY_TABLE)) throw platformHolidaysError;
    if (schoolVacationsError && !isMissingTableError(schoolVacationsError, 'school_vacations')) throw schoolVacationsError;
    if (crmContactsError && !isMissingTableError(crmContactsError, 'crm_contacts')) throw crmContactsError;
    if (crmNotesError && !isMissingTableError(crmNotesError, NOTES_TABLE)) throw crmNotesError;
    if (!isActiveDataLoad(requestId)) {
      return;
    }

    state.weeklyReports = reports ?? [];
    state.profiles = profiles ?? [];
    state.holidayRequests = absences ?? [];
    state.requestHistory = requestHistory ?? [];
    state.projects = projects ?? [];
    state.dailyAssignments = dailyAssignments ?? [];
    state.platformHolidays = platformHolidays ?? [];
    state.schoolVacations = schoolVacations ?? [];
    state.crmContacts = crmContacts ?? [];
    state.crmNotes = crmNotes ?? [];
    if (state.selectedCrmContactId && !state.crmContacts.some((item) => String(item.id) === String(state.selectedCrmContactId))) {
      state.selectedCrmContactId = null;
    }
    state.roleAssignments = [];
    syncEmployeeSelection();
    syncAbsenceSelection();
    elements.dataTimestamp.textContent = `Letzte Aktualisierung: ${new Date().toLocaleString('de-CH')}`;
    finishDataLoad(requestId);
    render();
    if (state.pendingDataReload) {
      state.pendingDataReload = false;
      loadData().catch((error) => {
        console.error(error);
      });
    }
  } catch (error) {
    if (!finishDataLoad(requestId)) {
      return;
    }
    console.error(error);
    const hint = getAccessConfigurationHint(error);
    elements.dataTimestamp.textContent = hint || 'Daten konnten nicht geladen werden';
    render();
    alert(`Daten konnten nicht geladen werden: ${error.message}${hint ? `\n\nHinweis: ${hint}` : ''}`);
    if (state.pendingDataReload) {
      state.pendingDataReload = false;
      loadData().catch((nextError) => {
        console.error(nextError);
      });
    }
  }
}

async function fetchCurrentProfile() {
  const { data, error } = await state.supabase
    .from('app_profiles')
    .select('*')
    .eq('id', state.user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function fetchProfiles() {
  const primary = await state.supabase.from('profiles').select('*').order('full_name', { ascending: true });
  if (!primary.error) {
    return primary;
  }
  return state.supabase.from('app_profiles').select('*').order('full_name', { ascending: true });
}

async function loadDemoData() {
  state.currentProfile = demoProfiles.find((profile) => profile.id === state.user.id) ?? demoProfiles[0];
  state.isAdminStatusResolved = true;

  if (!state.hasAdminAccess) {
    state.profiles = [];
    state.weeklyReports = [];
    state.projects = [];
    state.roleAssignments = [];
    state.dailyAssignments = [];
    state.holidayRequests = [];
    state.requestHistory = [];
    state.platformHolidays = [];
    state.schoolVacations = [];
    elements.dataTimestamp.textContent = 'Kein Zugriff – Demo-Profil hat is_admin = false';
    return;
  }

  state.profiles = demoProfiles;

  const { year: selectedYear, kw: selectedKw } = getYearAndWeekFromWeekValue(state.selectedWeek);
  const reports = demoWeeklyReports.filter((report) => {
    const reportYear = Number(report.year);
    const reportKw = Number(report.kw);
    if (Number.isInteger(reportYear) && Number.isInteger(reportKw)) {
      return reportYear === selectedYear && reportKw === selectedKw;
    }
    const isoWeek = getIsoYearAndWeekFromDateString(report.work_date);
    return isoWeek.year === selectedYear && isoWeek.kw === selectedKw;
  });
  state.weeklyReports = reports;
  state.projects = [];
  state.roleAssignments = [];
  state.dailyAssignments = [];
  state.holidayRequests = [...demoHolidayRequests];
  state.requestHistory = [...demoRequestHistory];
  state.platformHolidays = [...demoPlatformHolidays];
  state.schoolVacations = [];
  state.crmContacts = [];
  state.crmNotes = [];
  state.selectedCrmContactId = null;
  syncEmployeeSelection();
  syncAbsenceSelection();
  elements.dataTimestamp.textContent = `Demo-Daten geladen: ${new Date().toLocaleString('de-CH')}`;
}

function render() {
  const loggedIn = Boolean(state.user);
  const hasAdminAccess = loggedIn && state.hasAdminAccess;
  const isCheckingAdminAccess = loggedIn && !state.isAdminStatusResolved && !state.currentProfile;
  const showAccessDenied = loggedIn && state.isAdminStatusResolved && !state.hasAdminAccess;

  elements.loginView.classList.toggle('hidden', loggedIn || isCheckingAdminAccess);
  elements.appView.classList.toggle('hidden', !hasAdminAccess);
  elements.accessDeniedView.classList.toggle('hidden', !showAccessDenied);

  if (isCheckingAdminAccess) {
    closeReportEditModal();
    closeAdjustedMinutesModal();
    elements.accessDeniedView.classList.add('hidden');
    elements.loginView.classList.remove('hidden');
    if (elements.loginAlert) {
      showLoginMessage('Admin-Zugriff wird geprüft …', false);
    }
    renderLoadingOverlay();
    return;
  }

  if (!hasAdminAccess) {
    closeReportEditModal();
    closeAdjustedMinutesModal();
    renderLoadingOverlay();
    return;
  }

  renderSidebar();
  renderPages();
  renderWeekSummary();
  renderReportStats();
  renderEmployeeFilters();
  renderAbsenceFilters();
  renderReportsTable();
  renderSubmissionLists();
  renderAbsenceTable();
  renderConfirmationsModalState();
  renderConfirmationsTable();
  renderSaldoTable();
  renderProjectForm();
  renderProjectsTable();
  renderDispoPlanner();
  renderSettingsUsersTable();
  renderSettingsHolidaysTable();
  renderSettingsSchoolVacationsTable();
  renderCrmContactsTable();
  renderCrmContactDetail();
  renderCrmNotesPanel();
  renderLoadingOverlay();
}

function renderSidebar() {
  const profile = state.currentProfile;
  if (elements.userName) {
    elements.userName.textContent = profile?.full_name ?? state.user.email;
  }
  if (elements.userRole) {
    elements.userRole.textContent = profile?.role_label ?? 'Benutzer';
  }
  if (elements.userBadge) {
    elements.userBadge.textContent = state.hasAdminAccess ? 'Admin' : 'Kein Zugriff';
  }
}

function renderLoadingOverlay() {
  if (!elements.loadingOverlay || !elements.loadingOverlayText) {
    return;
  }
  elements.loadingOverlay.classList.toggle('hidden', !state.isLoadingOverlayVisible);
  elements.loadingOverlayText.textContent = state.loadingOverlayReason || 'Aktion wird ausgeführt.';
}

function scheduleLoadingOverlay(reason) {
  if (state.loadingOverlayTimer) {
    clearTimeout(state.loadingOverlayTimer);
  }
  state.loadingOverlayTimer = setTimeout(() => {
    state.isLoadingOverlayVisible = true;
    state.loadingOverlayReason = reason || 'Aktion wird ausgeführt.';
    renderLoadingOverlay();
  }, LONG_TASK_OVERLAY_DELAY_MS);
}

function hideLoadingOverlay() {
  if (state.loadingOverlayTimer) {
    clearTimeout(state.loadingOverlayTimer);
    state.loadingOverlayTimer = null;
  }
  state.isLoadingOverlayVisible = false;
  state.loadingOverlayReason = '';
  renderLoadingOverlay();
}

async function withLongTask(reason, task) {
  state.loadingTaskDepth += 1;
  if (state.loadingTaskDepth === 1) {
    scheduleLoadingOverlay(reason);
  }

  try {
    return await task();
  } finally {
    state.loadingTaskDepth = Math.max(0, state.loadingTaskDepth - 1);
    if (state.loadingTaskDepth === 0) {
      hideLoadingOverlay();
    }
  }
}

function renderPages() {
  const pageTitles = {
    reports: 'Wochenrapporte',
    absences: 'Ferien & Absenzen',
    saldo: 'Saldo',
    projects: 'Projekte / Aufträge',
    projectDetail: 'Projekt-Detail',
    dispo: 'Dispo / Wochenplanung',
    crm: 'CRM',
    settings: 'Einstellungen',
  };

  elements.pageTitle.textContent = pageTitles[state.currentPage];

  for (const [key, page] of Object.entries(elements.pages)) {
    if (!page) continue;
    page.classList.toggle('hidden', key !== state.currentPage);
  }

  elements.navTabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.page === state.currentPage);
  });
}

function renderWeekSummary() {
  const weekRange = getWeekRange(state.selectedWeek);
  elements.weekPicker.value = state.selectedWeek;
  elements.weekLabel.textContent = getWeekLabel(state.selectedWeek);
  elements.weekDateRange.textContent = `${formatDate(weekRange.start)} – ${formatDate(weekRange.end)}`;
  const disableWeekNavigation = state.isLoadingData || state.isSavingReport;
  elements.previousWeekButton.disabled = disableWeekNavigation;
  elements.nextWeekButton.disabled = disableWeekNavigation;
  if (elements.dispoPreviousWeekButton) elements.dispoPreviousWeekButton.disabled = disableWeekNavigation;
  if (elements.dispoNextWeekButton) elements.dispoNextWeekButton.disabled = disableWeekNavigation;
}

function renderReportStats() {
  const missingProfiles = getIncompleteSubmissionProfiles();
  const hasMissingReports = missingProfiles.length > 0;

  elements.reportStatusButton.classList.toggle('is-missing', hasMissingReports);
  elements.reportStatusButton.classList.toggle('is-complete', !hasMissingReports);
  elements.reportStatusIcon.textContent = hasMissingReports ? String(missingProfiles.length) : '✔';
  elements.reportStatusText.textContent = hasMissingReports ? 'fehlende/unvollständige Rapporte' : 'Alle Wochenrapporte vollständig';
}

function renderEmployeeFilters() {
  elements.employeeFilterInput.value = state.employeeFilterQuery;
  if (elements.showControlledReportsInput) {
    elements.showControlledReportsInput.checked = state.showControlledReports;
  }
  const profiles = getReportableProfiles();
  const visibleProfiles = getMatchingProfiles(profiles, state.employeeFilterQuery).slice(0, MAX_VISIBLE_FILTER_OPTIONS);

  elements.selectedEmployeesSummary.textContent = `${state.selectedEmployeeIds.length} von ${profiles.length} Mitarbeitenden ausgewählt`;

  if (!profiles.length) {
    elements.employeeFilterList.innerHTML = '<div class="empty-state">Keine Mitarbeitenden vorhanden.</div>';
    return;
  }

  elements.employeeFilterList.innerHTML = visibleProfiles.length
    ? visibleProfiles
        .map((profile) => `
          <label class="employee-filter-option">
            <input type="checkbox" value="${escapeAttribute(profile.id)}" ${state.selectedEmployeeIds.includes(profile.id) ? 'checked' : ''} />
            <span>${escapeHtml(profile.full_name)}</span>
          </label>
        `)
        .join('')
    : '<div class="empty-state">Keine Mitarbeitenden für diesen Suchbegriff gefunden.</div>';
}

function renderAbsenceFilters() {
  if (!elements.absenceFilterInput || !elements.absenceFilterList || !elements.selectedAbsenceEmployeesSummary) {
    return;
  }
  elements.absenceFilterInput.value = state.absenceFilterQuery;
  if (elements.showControlledAbsencesInput) {
    elements.showControlledAbsencesInput.checked = state.showControlledAbsences;
  }
  const profiles = getAbsenceFilterProfiles();
  const visibleProfiles = getMatchingProfiles(profiles, state.absenceFilterQuery).slice(0, MAX_VISIBLE_FILTER_OPTIONS);

  elements.selectedAbsenceEmployeesSummary.textContent = `${state.selectedAbsenceEmployeeIds.length} von ${profiles.length} Mitarbeitenden ausgewählt`;

  if (!profiles.length) {
    elements.absenceFilterList.innerHTML = '<div class="empty-state">Keine Mitarbeitenden vorhanden.</div>';
    return;
  }

  elements.absenceFilterList.innerHTML = visibleProfiles.length
    ? visibleProfiles
        .map((profile) => `
          <label class="employee-filter-option">
            <input type="checkbox" value="${escapeAttribute(profile.id)}" ${state.selectedAbsenceEmployeeIds.includes(profile.id) ? 'checked' : ''} />
            <span>${escapeHtml(profile.full_name)}</span>
          </label>
        `)
        .join('')
    : '<div class="empty-state">Keine Mitarbeitenden für diesen Suchbegriff gefunden.</div>';
}

function renderReportsTable() {
  if (state.isLoadingData) {
    elements.reportsTableBody.innerHTML = `<tr><td colspan="10">Rapporte für ${escapeHtml(getWeekLabel(state.selectedWeek))} werden geladen …</td></tr>`;
    renderReportsPagination({ totalItems: 0, totalPages: 1, currentPage: 1, startIndex: 0, endIndex: 0 });
    return;
  }

  const allReports = getSortedFilteredReports();
  const pagination = getReportsPaginationMeta(allReports);

  if (!state.weeklyReports.length) {
    elements.reportsTableBody.innerHTML = `<tr><td colspan="10">Keine Rapporte in dieser Woche gefunden.</td></tr>`;
    renderReportsPagination(pagination);
    return;
  }

  if (!allReports.length) {
    elements.reportsTableBody.innerHTML = `<tr><td colspan="10">Für die aktuelle Auswahl wurden keine Rapporte gefunden.</td></tr>`;
    renderReportsPagination(pagination);
    return;
  }

  elements.reportsTableBody.innerHTML = pagination.pageItems
    .map((report) => {
      const profile = getProfileById(report.profile_id);
      return `
        <tr class="report-row report-row-clickable" data-action="open-report-edit" data-report-id="${escapeAttribute(report.id)}">
          <td>${escapeHtml(profile?.full_name ?? 'Unbekannt')}</td>
          <td>${renderControllCell(report)}</td>
          <td>${formatDate(report.work_date)}</td>
          <td>${escapeHtml(report.commission_number || '–')}</td>
          <td>${formatTimeRange(report.start_time, report.end_time)}</td>
          <td>${formatMinutes(report.total_work_minutes)}</td>
          <td>
            <button class="adjusted-time-button" type="button" data-action="edit-adjusted-time" data-report-id="${escapeAttribute(report.id)}">
              ${formatMinutes(getAdjustedWorkMinutes(report))}
            </button>
          </td>
          <td>${formatCurrency(Number(report.expenses_amount || 0) + Number(report.other_costs_amount || 0))}</td>
          <td>${renderAttachmentLinks(report.attachments)}</td>
          <td>
            <div class="table-row-actions">
              <button class="button button-small button-danger" type="button" data-action="delete-report" data-report-id="${escapeAttribute(report.id)}" ${state.isSavingReport ? 'disabled' : ''}>Löschen</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
  renderReportsPagination(pagination);
}

function renderAbsenceTable() {
  if (!state.holidayRequests.length) {
    elements.absencesTableBody.innerHTML = `<tr><td colspan="9">Keine Ferien- oder Absenzanträge gefunden.</td></tr>`;
    return;
  }

  const sorted = getFilteredHolidayRequests();
  if (!sorted.length) {
    elements.absencesTableBody.innerHTML = `<tr><td colspan="9">Keine Ferien- oder Absenzanträge gefunden.</td></tr>`;
    return;
  }

  elements.absencesTableBody.innerHTML = sorted
    .map((request) => {
      const profile = getProfileById(request.profile_id);
      return `
        <tr>
          <td>${escapeHtml(profile?.full_name ?? 'Unbekannt')}</td>
          <td>${escapeHtml(getAbsenceTypeLabel(request, request.request_type))}</td>
          <td>${formatDate(request.start_date)}</td>
          <td>${formatDate(request.end_date)}</td>
          <td>${escapeHtml(request.notes || '–')}</td>
          <td>${renderAttachmentLinks(request.attachments)}</td>
          <td>${renderHolidayApprovalCell(request, 'controll_pl', 'PL')}</td>
          <td>${renderHolidayApprovalCell(request, 'controll_gl', 'GL', false)}</td>
          <td>${renderHolidayRejectCell(request)}</td>
        </tr>
      `;
    })
    .join('');
}


function renderConfirmationsModalState() {
  if (!elements.includeConfirmationHistoryInput || !elements.confirmationsModal) return;
  elements.includeConfirmationHistoryInput.checked = state.includeConfirmationHistory;
  elements.confirmationsModal.classList.toggle('hidden', !state.isConfirmationsModalOpen);
}

function renderConfirmationsTable() {
  if (!elements.confirmationsTableBody) {
    return;
  }

  const filteredHistory = getFilteredRequestHistory();

  if (!state.requestHistory.length) {
    elements.confirmationsTableBody.innerHTML = '<tr><td colspan="6">Keine Bestätigungen in request_history gefunden.</td></tr>';
    return;
  }

  if (!filteredHistory.length) {
    elements.confirmationsTableBody.innerHTML = '<tr><td colspan="6">Für den gewählten Zeitraum wurden keine Bestätigungen gefunden.</td></tr>';
    return;
  }

  elements.confirmationsTableBody.innerHTML = filteredHistory
    .map((entry) => {
      const details = parseRequestHistoryEntry(entry);
      const profile = getProfileById(entry.profile_id);
      const personLabel = profile?.full_name || profile?.email || 'Unbekannt';
      const personSubLabel = profile?.email && profile?.email !== personLabel ? `<div class="subtle-text">${escapeHtml(profile.email)}</div>` : '';
      return `
        <tr>
          <td>
            <div class="status-stack compact">
              <strong>${escapeHtml(personLabel)}</strong>
              ${personSubLabel}
            </div>
          </td>
          <td>${escapeHtml(details.typeLabel)}</td>
          <td>${escapeHtml(details.periodLabel)}</td>
          <td>${escapeHtml(details.approvedByLabel)}</td>
          <td>${escapeHtml(formatDateTime(entry.created_at))}</td>
          <td>${renderHistoryActionsCell(entry)}</td>
        </tr>
      `;
    })
    .join('');
}

function renderSaldoTable() {
  if (!elements.saldoTableBody) {
    return;
  }

  const profiles = getReportableProfiles();
  if (!profiles.length) {
    elements.saldoTableBody.innerHTML = '<tr><td colspan="11">Keine Profile gefunden.</td></tr>';
    return;
  }

  const currentIsoWeek = getCurrentIsoWeekNumber();
  elements.saldoTableBody.innerHTML = profiles
    .map((profile) => {
      const metrics = getProfileSaldoMetrics(profile, currentIsoWeek);
      return `
        <tr>
          <td>${escapeHtml(profile.full_name || '–')}</td>
          <td>${escapeHtml(profile.email || '–')}</td>
          <td>${renderSaldoInput(profile.id, 'vacation_allowance_hours', metrics.vacationAllowanceHours)}</td>
          <td>${metrics.bookedVacationHours.toFixed(2)}</td>
          <td>${renderSaldoInput(profile.id, 'carryover_overtime_hours', metrics.carryoverOvertimeHours)}</td>
          <td>${metrics.reportedHours.toFixed(2)}</td>
          <td>${renderSaldoInput(profile.id, 'credited_hours', metrics.creditedHours)}</td>
          <td>${renderSaldoInput(profile.id, 'weekly_hours', metrics.weeklyHours, 0.25)}</td>
          <td>${metrics.overtimeBalanceHours.toFixed(2)}</td>
          <td>${metrics.vacationBalanceHours.toFixed(2)}</td>
          <td>
            <button class="button button-small button-primary" type="button" data-action="save-saldo-profile" data-profile-id="${escapeAttribute(profile.id)}" ${state.isSavingSaldo ? 'disabled' : ''}>
              Speichern
            </button>
          </td>
        </tr>
      `;
    })
    .join('');
}

function renderSubmissionLists() {
  const summaries = getProfileSubmissionSummary();
  const submittedItems = summaries
    .filter((summary) => summary.hasSubmission)
    .map((summary) => {
      const statusLabel = summary.hasPendingControll ? 'Kontrolle ausstehend' : 'Rapporte erfasst';
      const statusClass = summary.hasPendingControll ? 'warning' : 'success';
      return `
      <li class="align-start">
        <div class="status-stack">
          <strong>${escapeHtml(summary.profile.full_name)}</strong>
          <div class="subtle-text">${summary.entryCount} Rapporteinträge in dieser Woche</div>
        </div>
        <div class="status-meta">
          <span class="pill ${statusClass}">${escapeHtml(statusLabel)}</span>
          <strong>${formatMinutes(summary.totalMinutes)}</strong>
        </div>
      </li>
    `;
    });

  const missingItems = getIncompleteSubmissionProfiles()
    .map(
      (entry) => `
      <li class="align-start">
        <div class="status-stack">
          <strong>${escapeHtml(entry.profile.full_name)}</strong>
          <div class="subtle-text">${escapeHtml(entry.description)}</div>
        </div>
        <div class="status-meta">
          <span class="pill warning">${escapeHtml(entry.statusLabel)}</span>
          <strong>${formatMinutes(entry.totalMinutes)}</strong>
        </div>
      </li>
    `,
    );

  elements.submissionList.innerHTML = submittedItems.join('') || '<li>In dieser Woche wurde noch kein Rapport erfasst.</li>';
  elements.missingList.innerHTML = missingItems.join('') || '<li>Alle Profile haben abgegeben.</li>';
}

function handleEmployeeFilterInput(event) {
  state.employeeFilterQuery = event.target.value;
  state.reportsPage = 1;
  renderEmployeeFilters();
}

function handleAbsenceFilterInput(event) {
  state.absenceFilterQuery = event.target.value;
  renderAbsenceFilters();
}

function handleShowControlledReportsToggle() {
  state.showControlledReports = Boolean(elements.showControlledReportsInput?.checked);
  state.reportsPage = 1;
  renderReportsTable();
}

function handleShowControlledAbsencesToggle() {
  state.showControlledAbsences = Boolean(elements.showControlledAbsencesInput?.checked);
  renderAbsenceTable();
}

function handleDispoMultiEntryToggle() {
  state.dispoAllowMultiplePerDay = Boolean(elements.dispoMultiEntryInput?.checked);
  renderDispoPlanner();
}

function handleConfirmationHistoryToggle() {
  state.includeConfirmationHistory = Boolean(elements.includeConfirmationHistoryInput?.checked);
  renderConfirmationsTable();
}

function handleEmployeeSelectionChange(event) {
  if (event.target?.type !== 'checkbox') {
    return;
  }

  const profileId = event.target.value;
  if (event.target.checked) {
    if (!state.selectedEmployeeIds.includes(profileId)) {
      state.selectedEmployeeIds = [...state.selectedEmployeeIds, profileId];
    }
  } else {
    state.selectedEmployeeIds = state.selectedEmployeeIds.filter((id) => id !== profileId);
  }

  state.employeeSelectionInitialized = true;
  state.employeeSelectionTouched = true;
  state.reportsPage = 1;
  render();
}

function handleAbsenceSelectionChange(event) {
  if (event.target?.type !== 'checkbox') {
    return;
  }

  const profileId = event.target.value;
  if (event.target.checked) {
    if (!state.selectedAbsenceEmployeeIds.includes(profileId)) {
      state.selectedAbsenceEmployeeIds = [...state.selectedAbsenceEmployeeIds, profileId];
    }
  } else {
    state.selectedAbsenceEmployeeIds = state.selectedAbsenceEmployeeIds.filter((id) => id !== profileId);
  }

  state.absenceSelectionInitialized = true;
  state.absenceSelectionTouched = true;
  render();
}

function selectAllEmployees() {
  state.selectedEmployeeIds = getAvailableReportProfileIds();
  state.employeeSelectionInitialized = true;
  state.employeeSelectionTouched = true;
  state.reportsPage = 1;
  render();
}

function clearEmployeeSelection() {
  state.selectedEmployeeIds = [];
  state.employeeSelectionInitialized = true;
  state.employeeSelectionTouched = true;
  state.reportsPage = 1;
  render();
}

function selectAllAbsenceEmployees() {
  state.selectedAbsenceEmployeeIds = getAvailableAbsenceProfileIds();
  state.absenceSelectionInitialized = true;
  state.absenceSelectionTouched = true;
  render();
}

function clearAbsenceSelection() {
  state.selectedAbsenceEmployeeIds = [];
  state.absenceSelectionInitialized = true;
  state.absenceSelectionTouched = true;
  render();
}

function syncEmployeeSelection() {
  const validIds = getAvailableReportProfileIds();
  const validIdSet = new Set(validIds);
  const selected = state.selectedEmployeeIds.filter((id) => validIdSet.has(id));

  if (!state.employeeSelectionInitialized) {
    state.selectedEmployeeIds = [...validIds];
    state.employeeSelectionInitialized = true;
    state.reportsPage = 1;
    return;
  }

  if (!state.employeeSelectionTouched) {
    state.selectedEmployeeIds = [...validIds];
    state.reportsPage = 1;
    return;
  }

  state.selectedEmployeeIds = validIds.length ? selected : [];
  const pageCount = Math.max(1, Math.ceil(getSortedFilteredReports().length / state.reportsPerPage));
  state.reportsPage = Math.min(state.reportsPage, pageCount);
}

function syncAbsenceSelection() {
  const validIds = getAvailableAbsenceProfileIds();
  const validIdSet = new Set(validIds);
  const selected = state.selectedAbsenceEmployeeIds.filter((id) => validIdSet.has(id));

  if (!state.absenceSelectionInitialized) {
    state.selectedAbsenceEmployeeIds = [...validIds];
    state.absenceSelectionInitialized = true;
    return;
  }

  if (!state.absenceSelectionTouched) {
    state.selectedAbsenceEmployeeIds = [...validIds];
    return;
  }

  state.selectedAbsenceEmployeeIds = validIds.length ? selected : [];
}

function getFilteredReports() {
  if (!state.selectedEmployeeIds.length && !state.employeeSelectionTouched) {
    return [...state.weeklyReports].filter((report) => state.showControlledReports || !String(report.controll || '').trim());
  }

  const selectedIds = new Set(state.selectedEmployeeIds);
  return state.weeklyReports.filter((report) => selectedIds.has(report.profile_id))
    .filter((report) => state.showControlledReports || !String(report.controll || '').trim());
}

function getSortedFilteredReports() {
  return [...getFilteredReports()].sort((a, b) => {
    const profileCompare = (getProfileById(a.profile_id)?.full_name ?? '').localeCompare(getProfileById(b.profile_id)?.full_name ?? '');
    if (profileCompare !== 0) return profileCompare;
    return `${a.work_date}${a.start_time}`.localeCompare(`${b.work_date}${b.start_time}`);
  });
}


function getFilteredRequestHistory() {
  const today = getTodayIsoDate();
  return [...state.requestHistory]
    .filter((entry) => {
      if (state.includeConfirmationHistory) return true;
      const details = parseRequestHistoryEntry(entry);
      const period = parseHistoryPeriod(details.periodLabel);
      if (!period) return true;
      return period.endDate >= today;
    })
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseHistoryPeriod(periodLabel) {
  const match = String(periodLabel || '').match(/(\d{4}-\d{2}-\d{2})\s+bis\s+(\d{4}-\d{2}-\d{2})/i);
  if (!match) return null;
  return { startDate: match[1], endDate: match[2] };
}

function parseRequestHistoryEntry(entry) {
  const requestValue = String(entry?.request || '').trim();
  const requestParts = requestValue ? requestValue.split(' | ').map((part) => part.trim()).filter(Boolean) : [];
  const typeLabel = requestParts[0] || 'Unbekannt';
  const periodMatch = requestParts.find((part) => part.includes(' bis '));

  return {
    typeLabel,
    periodLabel: periodMatch || '–',
    approvedByLabel: buildHistoryApprovedByLabel(entry),
  };
}

function buildHistoryApprovedByLabel(entry) {
  const contextValue = String(entry?.context || '').trim();
  if (!contextValue) {
    return '–';
  }

  const plMatch = contextValue.match(/PL:\s*([^|]+)/i);
  const glMatch = contextValue.match(/GL:\s*([^|]+)/i);
  const names = [plMatch?.[1], glMatch?.[1]]
    .map((value) => String(value || '').trim())
    .filter((value) => value && value !== '–');

  if (names.length) {
    return names.join(' / ');
  }

  return contextValue;
}

function formatDateTime(value) {
  if (!value) {
    return '–';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getReportsPaginationMeta(reports = getSortedFilteredReports()) {
  const totalItems = reports.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / state.reportsPerPage));
  const currentPage = Math.min(Math.max(1, state.reportsPage), totalPages);
  const startIndex = (currentPage - 1) * state.reportsPerPage;
  const endIndex = Math.min(startIndex + state.reportsPerPage, totalItems);

  state.reportsPage = currentPage;

  return {
    totalItems,
    totalPages,
    currentPage,
    startIndex,
    endIndex,
    pageItems: reports.slice(startIndex, endIndex),
  };
}

function renderReportsPagination({ totalItems, totalPages, currentPage, startIndex, endIndex }) {
  if (!elements.reportsPaginationSummary) {
    return;
  }

  elements.reportsPaginationSummary.textContent = totalItems
    ? `Seite ${currentPage} von ${totalPages} · ${startIndex + 1}-${endIndex} von ${totalItems} Rapporten`
    : 'Seite 1 von 1 · 0 Rapporte';
  elements.reportsPrevPageButton.disabled = currentPage <= 1;
  elements.reportsNextPageButton.disabled = currentPage >= totalPages || totalItems === 0;
}

function goToPreviousReportsPage() {
  if (state.reportsPage <= 1) {
    return;
  }

  state.reportsPage -= 1;
  renderReportsTable();
}

function goToNextReportsPage() {
  const totalPages = Math.max(1, Math.ceil(getSortedFilteredReports().length / state.reportsPerPage));
  if (state.reportsPage >= totalPages) {
    return;
  }

  state.reportsPage += 1;
  renderReportsTable();
}

function getProfileSubmissionSummary() {
  const groups = groupReportsByProfile(state.weeklyReports);
  return getReportableProfiles().map((profile) => {
    const reports = groups.get(profile.id) ?? [];
    const totalMinutes = reports.reduce((sum, report) => sum + getAdjustedWorkMinutes(report), 0);
    const hasPendingControll = reports.some((report) => !String(report.controll || '').trim());
    return {
      profile,
      reports,
      entryCount: reports.length,
      totalMinutes,
      hasSubmission: reports.length > 0,
      hasPendingControll,
    };
  });
}

function handleReportsTableClick(event) {
  if (event.target.closest('a')) {
    return;
  }

  const clickedRow = event.target.closest('tr[data-action="open-report-edit"]');
  if (clickedRow && !event.target.closest('button')) {
    const rowReportId = clickedRow.dataset.reportId;
    if (rowReportId) {
      openReportEditModal(rowReportId);
      return;
    }
  }

  const trigger = event.target.closest('[data-action]');
  if (!trigger) {
    return;
  }

  const reportId = trigger.dataset.reportId;
  if (!reportId) {
    return;
  }

  if (trigger.dataset.action === 'edit-report' || trigger.dataset.action === 'open-report-edit') {
    openReportEditModal(reportId);
    return;
  }

  if (trigger.dataset.action === 'edit-adjusted-time') {
    openAdjustedMinutesModal(reportId);
    return;
  }

  if (trigger.dataset.action === 'confirm-report') {
    handleConfirmReport(reportId);
    return;
  }

  if (trigger.dataset.action === 'delete-report') {
    handleDeleteReport(reportId);
  }
}

function handleAbsencesTableClick(event) {
  if (event.target.closest('a')) {
    return;
  }

  const trigger = event.target.closest('[data-action]');
  if (!trigger) {
    return;
  }

  const requestId = trigger.dataset.requestId;
  if (!requestId) {
    return;
  }

  if (trigger.dataset.action === 'confirm-absence-pl') {
    handleConfirmHolidayRequest(requestId, 'controll_pl', 'PL');
    return;
  }

  if (trigger.dataset.action === 'confirm-absence-gl') {
    handleConfirmHolidayRequest(requestId, 'controll_gl', 'GL');
    return;
  }

  if (trigger.dataset.action === 'reject-absence-request') {
    handleRejectHolidayRequest(requestId);
    return;
  }

  if (trigger.dataset.action === 'download-absence-confirmation') {
    exportHolidayConfirmationPdf(requestId);
  }
}

function handleConfirmationsTableClick(event) {
  const trigger = event.target.closest('[data-action]');
  if (!trigger) {
    return;
  }

  const historyEntryId = trigger.dataset.historyEntryId;
  if (!historyEntryId) {
    return;
  }

  if (trigger.dataset.action === 'download-history-confirmation') {
    exportRequestHistoryPdf(historyEntryId);
    return;
  }

  if (trigger.dataset.action === 'delete-history-entry') {
    handleDeleteHistoryEntry(historyEntryId);
  }
}

function handleSaldoTableClick(event) {
  const trigger = event.target.closest('[data-action="save-saldo-profile"]');
  if (!trigger) {
    return;
  }

  const profileId = trigger.dataset.profileId;
  if (!profileId) {
    return;
  }

  handleSaveSaldoProfile(profileId);
}

async function handleSettingsUsersTableClick(event) {
  const trigger = event.target.closest('[data-action]');
  if (!trigger || state.isSavingSettings) {
    return;
  }

  const profileId = trigger.dataset.profileId;
  const profile = state.profiles.find((item) => String(item.id) === String(profileId));
  if (!profile) {
    return;
  }

  const action = trigger.dataset.action;
  if (action === 'save-user-settings') {
    await handleSaveUserSettings(profileId);
    return;
  }

  if (action === 'purge-user-account') {
    await handlePurgeUserAccount(profile);
    return;
  }

  if (action === 'edit-block-days') {
    openBlockDayModal(profile);
    return;
  }

  if (action !== 'toggle-user-active') return;

  const nextValue = profile.is_active === false;
  state.isSavingSettings = true;
  try {
    if (state.isDemoMode) {
      const demoProfile = demoProfiles.find((item) => String(item.id) === String(profileId));
      if (demoProfile) demoProfile.is_active = nextValue;
    } else {
      const { error } = await state.supabase
        .from('app_profiles')
        .update({ is_active: nextValue })
        .eq('id', profileId);
      if (error) throw error;
    }
    await loadData();
  } catch (error) {
    console.error(error);
    alert(`Benutzerstatus konnte nicht aktualisiert werden: ${error.message}`);
  } finally {
    state.isSavingSettings = false;
    render();
  }
}

function handleSettingsUsersTableChange(event) {
  const roleSelect = event.target.closest('select[data-role-label-input]');
  if (!roleSelect) return;
  const profileId = roleSelect.dataset.roleLabelInput;
  const schoolDaySelect = document.querySelector(`select[data-school-day-input="${profileId}"]`);
  if (!schoolDaySelect) return;
  const blockSettingsButton = document.querySelector(`button[data-block-days-input="${profileId}"]`);
  const isApprentice = String(roleSelect.value || '').trim() === 'Lehrling';
  schoolDaySelect.disabled = state.isSavingSettings || !isApprentice;
  if (blockSettingsButton) {
    blockSettingsButton.disabled = state.isSavingSettings;
  }
  if (!isApprentice) {
    schoolDaySelect.value = '';
  }
}

function getSelectedSchoolDay(profileId) {
  const select = document.querySelector(`select[data-school-day-input="${profileId}"]`);
  const value = Number(select?.value);
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    return null;
  }
  return value;
}

function normalizeBlockSchedule(rawSchedule) {
  const rows = Array.isArray(rawSchedule) ? rawSchedule : [];
  return rows
    .map((entry) => {
      const weekday = Number(entry?.weekday);
      if (!Number.isInteger(weekday) || weekday < 1 || weekday > 5) {
        return null;
      }
      const legacyMode = String(entry?.mode || '').trim();
      const fallback = BLOCK_DAY_LEGACY_MODE_OPTIONS[legacyMode] || null;
      const start_time = normalizeDispoTimeValue(entry?.start_time, fallback?.start || BLOCK_DAY_DEFAULT_START);
      const end_time = normalizeDispoTimeValue(entry?.end_time, fallback?.end || BLOCK_DAY_DEFAULT_END);
      const startMinutes = parseClockToMinutes(start_time);
      const endMinutes = parseClockToMinutes(end_time);
      if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || endMinutes <= startMinutes) {
        return null;
      }
      return { weekday, start_time, end_time };
    })
    .filter(Boolean);
}

function parseBlockSchedule(profile) {
  if (!profile) return [];
  const raw = profile.block_schedule;
  if (Array.isArray(raw)) {
    return normalizeBlockSchedule(raw);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return normalizeBlockSchedule(JSON.parse(raw));
    } catch (error) {
      return [];
    }
  }
  return [];
}

function getBlockScheduleSummary(profile) {
  const schedule = parseBlockSchedule(profile);
  if (!schedule.length) return '–';
  return schedule
    .sort((left, right) => left.weekday - right.weekday || left.start_time.localeCompare(right.start_time))
    .map((entry) => `${WEEKDAY_LABELS[entry.weekday - 1]} (${entry.start_time}–${entry.end_time})`)
    .join(', ');
}

async function handleSaveUserSettings(profileId) {
  const roleSelect = document.querySelector(`select[data-role-label-input="${profileId}"]`);
  const roleLabel = String(roleSelect?.value || '').trim();
  const targetInput = document.querySelector(`[data-target-revenue-input="${profileId}"]`);
  if (!roleLabel) {
    alert('Bitte eine gültige Rolle auswählen.');
    return;
  }
  const schoolDay = getSelectedSchoolDay(profileId);
  if (roleLabel === 'Lehrling' && !schoolDay) {
    alert('Für Lehrlinge muss mindestens ein Schultag ausgewählt werden.');
    return;
  }
  const parsedTargetRevenue = Number(String(targetInput?.value || '').replace(',', '.'));
  if (!Number.isFinite(parsedTargetRevenue) || parsedTargetRevenue < 0) {
    alert('Bitte einen gültigen Sollerlös (CHF) >= 0 eingeben.');
    return;
  }
  const updates = {
    role_label: roleLabel,
    target_revenue: parsedTargetRevenue,
    school_day_1: roleLabel === 'Lehrling' ? schoolDay : null,
    school_day_2: null,
  };

  state.isSavingSettings = true;
  try {
    if (state.isDemoMode) {
      const demoProfile = demoProfiles.find((item) => String(item.id) === String(profileId));
      if (demoProfile) Object.assign(demoProfile, updates);
    } else {
      const { error } = await state.supabase.from('app_profiles').update(updates).eq('id', profileId);
      if (error) throw error;
    }
    const localProfile = state.profiles.find((item) => String(item.id) === String(profileId));
    if (localProfile) Object.assign(localProfile, updates);
    await synchronizeApprenticeSchoolReportsForYears(profileId, getSchoolReportSyncYears());
    await loadData();
  } catch (error) {
    console.error(error);
    alert(`Benutzereinstellungen konnten nicht gespeichert werden: ${error.message}`);
  } finally {
    state.isSavingSettings = false;
    render();
  }
}

function openBlockDayModal(profile) {
  if (!elements.blockDayModal || !profile) return;
  const year = new Date().getUTCFullYear();
  elements.blockDayProfileIdInput.value = profile.id;
  elements.blockDayYearInput.value = String(year);
  const selectedEntries = parseBlockSchedule(profile);
  const selectedByWeekday = new Map(selectedEntries.map((entry) => [entry.weekday, entry]));
  const rows = SCHOOL_DAY_OPTIONS.map((day) => {
    const existing = selectedByWeekday.get(day.value);
    return `<tr>
      <td>${escapeHtml(day.label)}</td>
      <td><label class="checkbox-inline"><input type="checkbox" data-blockday-active="${day.value}" ${existing ? 'checked' : ''} /><span>Ja</span></label></td>
      <td><input type="time" data-blockday-start="${day.value}" value="${escapeAttribute(existing?.start_time || BLOCK_DAY_DEFAULT_START)}" /></td>
      <td><input type="time" data-blockday-end="${day.value}" value="${escapeAttribute(existing?.end_time || BLOCK_DAY_DEFAULT_END)}" /></td>
    </tr>`;
  }).join('');
  elements.blockDayOptionsBody.innerHTML = rows;
  elements.blockDayModal.classList.remove('hidden');
}

function closeBlockDayModal() {
  if (!elements.blockDayModal) return;
  elements.blockDayModal.classList.add('hidden');
  if (elements.blockDayForm) elements.blockDayForm.reset();
}

function isMissingBlockScheduleColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  if (!message) return false;
  return message.includes("'block_schedule'") && message.includes("'app_profiles'") && message.includes('schema cache');
}

async function handleBlockDayFormSubmit(event) {
  event.preventDefault();
  if (state.isSavingSettings) return;
  const profileId = String(elements.blockDayProfileIdInput?.value || '').trim();
  const year = Number(elements.blockDayYearInput?.value);
  if (!profileId) return;
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    alert('Bitte ein gültiges Kalenderjahr wählen.');
    return;
  }
  const blockSchedule = [];
  for (const day of SCHOOL_DAY_OPTIONS) {
    const activeInput = elements.blockDayOptionsBody?.querySelector(`input[data-blockday-active="${day.value}"]`);
    if (!(activeInput instanceof HTMLInputElement) || !activeInput.checked) continue;
    const startInput = elements.blockDayOptionsBody?.querySelector(`input[data-blockday-start="${day.value}"]`);
    const endInput = elements.blockDayOptionsBody?.querySelector(`input[data-blockday-end="${day.value}"]`);
    const start_time = normalizeDispoTimeValue(startInput?.value, BLOCK_DAY_DEFAULT_START);
    const end_time = normalizeDispoTimeValue(endInput?.value, BLOCK_DAY_DEFAULT_END);
    const startMinutes = parseClockToMinutes(start_time);
    const endMinutes = parseClockToMinutes(end_time);
    if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || endMinutes <= startMinutes) {
      alert(`Ungültige Blockzeit für ${day.label}. Bitte "Von" und "Bis" prüfen.`);
      return;
    }
    blockSchedule.push({ weekday: day.value, start_time, end_time });
  }
  state.isSavingSettings = true;
  try {
    if (state.isDemoMode) {
      const demoProfile = demoProfiles.find((item) => String(item.id) === String(profileId));
      if (demoProfile) {
        demoProfile.block_schedule = blockSchedule;
      }
    } else {
      const { error } = await state.supabase.from('app_profiles').update({ block_schedule: blockSchedule }).eq('id', profileId);
      if (error) throw error;
    }
    const profile = state.profiles.find((item) => String(item.id) === String(profileId));
    if (profile) profile.block_schedule = blockSchedule;
    await synchronizeBlockDayReportsForYear(profileId, year);
    closeBlockDayModal();
    await loadData();
  } catch (error) {
    console.error(error);
    const errorMessage = isMissingBlockScheduleColumnError(error)
      ? BLOCK_SCHEDULE_SCHEMA_HINT
      : error.message;
    alert(`Blocktage konnten nicht gespeichert werden: ${errorMessage}`);
  } finally {
    state.isSavingSettings = false;
    render();
  }
}

async function handlePurgeUserAccount(profile) {
  const profileId = profile?.id;
  if (!profileId) return;
  if (String(profileId) === String(state.currentProfile?.id)) {
    alert('Der eigene Account kann hier nicht gelöscht werden.');
    return;
  }
  const shouldDelete = window.confirm(`Account von "${profile.full_name || profile.email}" inkl. Dateien wirklich restlos entfernen?`);
  if (!shouldDelete) return;

  state.isSavingSettings = true;
  try {
    if (state.isDemoMode) {
      const index = demoProfiles.findIndex((item) => String(item.id) === String(profileId));
      if (index >= 0) demoProfiles.splice(index, 1);
    } else {
      const { error } = await state.supabase.rpc('purge_user_account', {
        p_profile_id: profileId,
      });
      if (error) throw error;
    }
    await loadData();
  } catch (error) {
    console.error(error);
    alert(`Account konnte nicht vollständig entfernt werden: ${error.message}`);
  } finally {
    state.isSavingSettings = false;
    render();
  }
}

async function handleHolidayFormSubmit(event) {
  event.preventDefault();
  if (state.isSavingSettings) return;

  const holidayDate = String(elements.holidayDateInput?.value || '').trim();
  const label = String(elements.holidayNameInput?.value || '').trim();
  const isPaid = String(elements.holidayIsPaidInput?.value || 'true') !== 'false';
  if (!holidayDate || !label) {
    alert('Bitte Datum und Bezeichnung erfassen.');
    return;
  }

  state.isSavingSettings = true;
  try {
    await createPlatformHoliday(holidayDate, label, isPaid);
    if (elements.holidayForm) {
      elements.holidayForm.reset();
    }
    await loadData();
  } catch (error) {
    console.error(error);
    alert(`Feiertag konnte nicht gespeichert werden: ${error.message}`);
  } finally {
    state.isSavingSettings = false;
    render();
  }
}

async function handleSettingsHolidaysTableClick(event) {
  const trigger = event.target.closest('[data-action]');
  if (!trigger || state.isSavingSettings) {
    return;
  }

  const holidayId = trigger.dataset.holidayId;
  if (!holidayId) return;
  const action = String(trigger.dataset.action || '').trim();

  if (action === 'start-edit-holiday') {
    state.editingHolidayId = holidayId;
    render();
    return;
  }

  if (action === 'cancel-edit-holiday') {
    state.editingHolidayId = null;
    render();
    return;
  }

  if (action === 'save-edit-holiday') {
    const row = trigger.closest('tr');
    const select = row?.querySelector('[data-holiday-paid-select]');
    const isPaid = String(select?.value || 'true') !== 'false';
    state.isSavingSettings = true;
    try {
      await updatePlatformHolidayCompensation(holidayId, isPaid);
      state.editingHolidayId = null;
      await loadData();
    } catch (error) {
      console.error(error);
      alert(`Feiertag konnte nicht aktualisiert werden: ${error.message}`);
    } finally {
      state.isSavingSettings = false;
      render();
    }
    return;
  }

  if (action === 'delete-holiday') {
    if (!confirm('Feiertag aus der Liste entfernen?')) return;
    state.isSavingSettings = true;
    try {
      await deletePlatformHoliday(holidayId);
      state.editingHolidayId = null;
      await loadData();
    } catch (error) {
      console.error(error);
      alert(`Feiertag konnte nicht entfernt werden: ${error.message}`);
    } finally {
      state.isSavingSettings = false;
      render();
    }
  }
}

async function deleteHolidayWeeklyReportsForDate(holidayDate) {
  if (state.isDemoMode) {
    for (let index = demoWeeklyReports.length - 1; index >= 0; index -= 1) {
      const report = demoWeeklyReports[index];
      if (String(report.work_date) === String(holidayDate) && Number(report.abz_typ) === 5) {
        demoWeeklyReports.splice(index, 1);
      }
    }
    return;
  }

  const { error } = await state.supabase
    .from('weekly_reports')
    .delete()
    .eq('work_date', holidayDate)
    .eq('abz_typ', 5);
  if (error) throw error;
}

async function deletePlatformHoliday(holidayId) {
  const holiday = state.platformHolidays.find((item) => String(item.id) === String(holidayId));
  if (!holiday) {
    throw new Error('Feiertag nicht gefunden.');
  }

  if (state.isDemoMode) {
    const index = demoPlatformHolidays.findIndex((item) => String(item.id) === String(holidayId));
    if (index >= 0) demoPlatformHolidays.splice(index, 1);
  } else {
    const { error } = await state.supabase.from(HOLIDAY_TABLE).delete().eq('id', holidayId);
    if (error) throw error;
  }

  await deleteHolidayWeeklyReportsForDate(holiday.holiday_date);
}

async function updatePlatformHolidayCompensation(holidayId, isPaid) {
  const holiday = state.platformHolidays.find((item) => String(item.id) === String(holidayId));
  if (!holiday) {
    throw new Error('Feiertag nicht gefunden.');
  }

  if (state.isDemoMode) {
    const entry = demoPlatformHolidays.find((item) => String(item.id) === String(holidayId));
    if (entry) {
      entry.is_paid = isPaid;
    }
    demoWeeklyReports.forEach((report) => {
      if (String(report.work_date) === String(holiday.holiday_date) && Number(report.abz_typ) === 5) {
        report.total_work_minutes = isPaid ? 480 : 0;
        report.adjusted_work_minutes = isPaid ? 480 : 0;
        report.notes = `Automatisch aus ${isPaid ? 'bezahltem' : 'unbezahltem'} Feiertag (${holiday.label || 'Feiertag'}) erstellt.`;
      }
    });
    return;
  }

  const { error: holidayError } = await state.supabase.from(HOLIDAY_TABLE).update({ is_paid: isPaid }).eq('id', holidayId);
  if (holidayError) throw holidayError;

  const { error: reportError } = await state.supabase
    .from('weekly_reports')
    .update({
      total_work_minutes: isPaid ? 480 : 0,
      adjusted_work_minutes: isPaid ? 480 : 0,
      notes: `Automatisch aus ${isPaid ? 'bezahltem' : 'unbezahltem'} Feiertag (${holiday.label || 'Feiertag'}) erstellt.`,
    })
    .eq('work_date', holiday.holiday_date)
    .eq('abz_typ', 5);
  if (reportError) throw reportError;
}

function isAbsenceTypeCode(value) {
  return ABSENCE_TYPE_CODES.has(Number(value));
}

function buildHolidayWeeklyReportRow(profileId, holidayDate, label, isPaid = true) {
  const yearKw = getIsoYearAndWeekFromDateString(holidayDate);
  return {
    profile_id: profileId,
    work_date: holidayDate,
    year: yearKw.year,
    kw: yearKw.kw,
    project_name: 'Feiertag',
    commission_number: label || 'Feiertag',
    abz_typ: 5,
    start_time: '07:00',
    end_time: '16:30',
    lunch_break_minutes: 60,
    additional_break_minutes: 30,
    total_work_minutes: isPaid ? 480 : 0,
    adjusted_work_minutes: isPaid ? 480 : 0,
    expenses_amount: 0,
    other_costs_amount: 0,
    expense_note: '',
    notes: `Automatisch aus ${isPaid ? 'bezahltem' : 'unbezahltem'} Feiertag (${label || 'Feiertag'}) erstellt.`,
    controll: '',
    attachments: [],
  };
}

function groupReportsByProfile(reports) {
  return reports.reduce((map, report) => {
    const profileKey = String(report.profile_id);
    if (!map.has(profileKey)) {
      map.set(profileKey, []);
    }
    map.get(profileKey).push(report);
    return map;
  }, new Map());
}

async function loadReportsForHolidayDate(holidayDate, profileIds) {
  if (state.isDemoMode) {
    return demoWeeklyReports.filter((report) => String(report.work_date) === String(holidayDate) && profileIds.includes(report.profile_id));
  }

  const { data, error } = await state.supabase
    .from('weekly_reports')
    .select('*')
    .eq('work_date', holidayDate)
    .in('profile_id', profileIds);
  if (error) throw error;
  return data || [];
}

async function replaceWithHolidayWeeklyReport(profileId, holidayDate, label, isPaid, reportsToDelete) {
  if (state.isDemoMode) {
    if (reportsToDelete.length) {
      const reportIds = new Set(reportsToDelete.map((report) => String(report.id)));
      for (let index = demoWeeklyReports.length - 1; index >= 0; index -= 1) {
        if (reportIds.has(String(demoWeeklyReports[index].id))) {
          demoWeeklyReports.splice(index, 1);
        }
      }
    }
    demoWeeklyReports.push({ id: crypto.randomUUID(), ...buildHolidayWeeklyReportRow(profileId, holidayDate, label, isPaid) });
    return;
  }

  if (reportsToDelete.length) {
    const { error: deleteError } = await state.supabase.from('weekly_reports').delete().in('id', reportsToDelete.map((report) => report.id));
    if (deleteError) throw deleteError;
  }

  const { error: insertError } = await state.supabase.from('weekly_reports').insert(buildHolidayWeeklyReportRow(profileId, holidayDate, label, isPaid));
  if (insertError) throw insertError;
}

async function createHolidayWeeklyReportsForDate(holidayDate, label, isPaid = true) {
  const activeProfiles = getActiveProfiles();
  if (!activeProfiles.length) {
    return;
  }

  const profileIds = activeProfiles.map((profile) => profile.id);
  const existingRows = await loadReportsForHolidayDate(holidayDate, profileIds);
  const reportsByProfile = groupReportsByProfile(existingRows);

  for (const profile of activeProfiles) {
    const reportsForProfile = reportsByProfile.get(String(profile.id)) || [];
    const hasAutoBlockDay = reportsForProfile.some((report) => isAutoBlockDayReport(report));
    if (hasAutoBlockDay) {
      continue;
    }
    const absenceReportsForDate = reportsForProfile.filter((report) => isAbsenceTypeCode(report.abz_typ));
    // eslint-disable-next-line no-await-in-loop
    await replaceWithHolidayWeeklyReport(profile.id, holidayDate, label, isPaid, absenceReportsForDate);
  }
}

async function createPlatformHoliday(holidayDate, label, isPaid = true) {
  if (state.isDemoMode) {
    const alreadyExists = demoPlatformHolidays.some((item) => item.holiday_date === holidayDate);
    if (!alreadyExists) {
      demoPlatformHolidays.push({ id: crypto.randomUUID(), holiday_date: holidayDate, label, is_paid: isPaid });
    }
    await createHolidayWeeklyReportsForDate(holidayDate, label, isPaid);
    return;
  }

  const upsertResult = await state.supabase
    .from(HOLIDAY_TABLE)
    .upsert({ holiday_date: holidayDate, label, is_paid: isPaid }, { onConflict: 'holiday_date' })
    .select('*')
    .maybeSingle();
  if (upsertResult.error && !isMissingTableError(upsertResult.error, HOLIDAY_TABLE)) {
    throw upsertResult.error;
  }
  await createHolidayWeeklyReportsForDate(holidayDate, label, isPaid);
}

async function handleSchoolVacationFormSubmit(event) {
  event.preventDefault();
  if (state.isSavingSettings) return;
  const startDate = String(elements.schoolVacationStartInput?.value || '').trim();
  const endDate = String(elements.schoolVacationEndInput?.value || '').trim();
  if (!startDate || !endDate) {
    alert('Bitte Start- und Enddatum erfassen.');
    return;
  }
  if (endDate < startDate) {
    alert('Das Enddatum muss am oder nach dem Startdatum liegen.');
    return;
  }
  state.isSavingSettings = true;
  try {
    if (state.isDemoMode) {
      state.schoolVacations.push({ id: crypto.randomUUID(), start_date: startDate, end_date: endDate });
    } else {
      const { error } = await state.supabase.from('school_vacations').insert({ start_date: startDate, end_date: endDate });
      if (error) throw error;
    }
    await synchronizeAllApprenticeSchoolReportsForYears(getSchoolReportSyncYears());
    if (elements.schoolVacationForm) {
      elements.schoolVacationForm.reset();
    }
    await loadData();
  } catch (error) {
    console.error(error);
    alert(`Ferienzeit konnte nicht gespeichert werden: ${error.message}`);
  } finally {
    state.isSavingSettings = false;
    render();
  }
}

async function handleSettingsSchoolVacationsTableClick(event) {
  const trigger = event.target.closest('[data-action="delete-school-vacation"]');
  if (!trigger || state.isSavingSettings) return;
  const vacationId = trigger.dataset.schoolVacationId;
  if (!vacationId) return;
  if (!confirm('Ferienzeit entfernen?')) return;
  state.isSavingSettings = true;
  try {
    if (state.isDemoMode) {
      state.schoolVacations = state.schoolVacations.filter((item) => String(item.id) !== String(vacationId));
    } else {
      const { error } = await state.supabase.from('school_vacations').delete().eq('id', vacationId);
      if (error) throw error;
    }
    await synchronizeAllApprenticeSchoolReportsForYears(getSchoolReportSyncYears());
    await loadData();
  } catch (error) {
    console.error(error);
    alert(`Ferienzeit konnte nicht entfernt werden: ${error.message}`);
  } finally {
    state.isSavingSettings = false;
    render();
  }
}

function resetCrmContactForm() {
  if (elements.crmContactForm) {
    elements.crmContactForm.reset();
  }
  if (elements.crmContactIdInput) {
    elements.crmContactIdInput.value = '';
  }
  closeCrmContactModal();
}

async function handleCrmContactSubmit(event) {
  event.preventDefault();
  if (!state.supabase || state.isSavingSettings) return;

  const contactId = String(elements.crmContactIdInput?.value || '').trim();
  const payload = {
    category: String(elements.crmCategoryInput?.value || '').trim().toLowerCase(),
    company_name: String(elements.crmCompanyInput?.value || '').trim() || null,
    first_name: String(elements.crmFirstNameInput?.value || '').trim(),
    last_name: String(elements.crmLastNameInput?.value || '').trim(),
    street: String(elements.crmStreetInput?.value || '').trim() || null,
    city: String(elements.crmCityInput?.value || '').trim() || null,
    postal_code: String(elements.crmPostalCodeInput?.value || '').trim() || null,
    phone: String(elements.crmPhoneInput?.value || '').trim() || null,
    email: String(elements.crmEmailInput?.value || '').trim().toLowerCase() || null,
  };
  if (!payload.first_name || !payload.last_name || !Object.prototype.hasOwnProperty.call(CRM_CATEGORY_LABELS, payload.category)) {
    showInlineAlert(elements.crmAlert, 'Bitte Kategorie, Vorname und Nachname korrekt erfassen.', true);
    return;
  }

  state.isSavingSettings = true;
  try {
    const query = contactId
      ? state.supabase.from('crm_contacts').update(payload).eq('id', contactId)
      : state.supabase.from('crm_contacts').insert(payload);
    const { error } = await query;
    if (error) throw error;

    showInlineAlert(elements.crmAlert, contactId ? 'Kontakt aktualisiert.' : 'Kontakt erstellt.', false);
    resetCrmContactForm();
    await loadData();
  } catch (error) {
    console.error(error);
    showInlineAlert(elements.crmAlert, `Kontakt konnte nicht gespeichert werden: ${error.message}`, true);
  } finally {
    state.isSavingSettings = false;
    render();
  }
}

async function handleCrmContactsTableClick(event) {
  if (state.isSavingSettings) return;
  const button = event.target.closest('button[data-action]');
  const row = event.target.closest('tr[data-action="open-crm-contact"]');
  const contactId = button?.dataset.contactId || row?.dataset.contactId;
  if (!contactId) return;
  const contact = state.crmContacts.find((item) => String(item.id) === String(contactId));
  if (!contact) return;

  if (button?.dataset.action === 'open-crm-contact' || row) {
    openCrmContactDetailPage(contact);
    return;
  }

  if (button?.dataset.action === 'edit-crm-contact') {
    openCrmContactModal(contact);
    return;
  }

  if (button?.dataset.action === 'delete-crm-contact') {
    if (!confirm('Kontakt wirklich löschen?')) return;
    state.isSavingSettings = true;
    try {
      const { error } = await state.supabase.from('crm_contacts').delete().eq('id', contactId);
      if (error) throw error;
      if (String(state.selectedCrmContactId) === String(contactId)) {
        state.selectedCrmContactId = null;
      }
      showInlineAlert(elements.crmAlert, 'Kontakt gelöscht.', false);
      await loadData();
    } catch (error) {
      console.error(error);
      showInlineAlert(elements.crmAlert, `Kontakt konnte nicht gelöscht werden: ${error.message}`, true);
    } finally {
      state.isSavingSettings = false;
      render();
    }
  }
}

function handleCrmSearchInput(event) {
  state.crmSearchQuery = String(event.target.value || '').trim().toLowerCase();
  renderCrmContactsTable();
}

function handleCrmCategoryFilterChange(event) {
  state.crmCategoryFilter = String(event.target.value || '').trim().toLowerCase();
  renderCrmContactsTable();
}

async function handleCrmNoteSubmit(event) {
  event.preventDefault();
  if (!state.supabase || state.isSavingSettings) return;
  const targetUid = String(elements.crmNoteTargetUidInput?.value || '').trim();
  const noteText = String(elements.crmNoteTextInput?.value || '').trim();
  if (!targetUid) {
    showInlineAlert(elements.crmAlert, 'Bitte zuerst einen Kontakt auswählen.', true);
    return;
  }
  if (!noteText) {
    showInlineAlert(elements.crmAlert, 'Bitte zuerst einen Kommentar erfassen.', true);
    return;
  }

  state.isSavingSettings = true;
  try {
    const { error } = await state.supabase.from(NOTES_TABLE).insert({
      target_uid: targetUid,
      note_type: CRM_NOTE_TYPE,
      note_text: noteText,
    });
    if (error) throw error;
    if (elements.crmNoteTextInput) {
      elements.crmNoteTextInput.value = '';
    }
    showInlineAlert(elements.crmAlert, 'Notiz gespeichert.', false);
    await loadData();
  } catch (error) {
    console.error(error);
    showInlineAlert(elements.crmAlert, `Notiz konnte nicht gespeichert werden: ${error.message}`, true);
  } finally {
    state.isSavingSettings = false;
    render();
  }
}

async function handleConfirmReport(reportId) {
  if (!reportId || state.isSavingReport) {
    return;
  }

  const controllName = getControllDisplayName();
  if (!controllName) {
    alert('Der Name für die Kontrolle konnte nicht ermittelt werden.');
    return;
  }

  state.isSavingReport = true;
  try {
    await withLongTask('Rapport wird bestätigt …', async () => {
      const existingReport = state.weeklyReports.find((item) => String(item.id) === String(reportId));
      const wasAlreadyConfirmed = Boolean(String(existingReport?.controll || '').trim());

      if (state.isDemoMode) {
        updateDemoReport(reportId, { controll: controllName });
        if (existingReport && !wasAlreadyConfirmed) {
          applyDemoReportBookingDelta(existingReport, 1);
        }
      } else {
        const { error } = await state.supabase
          .from('weekly_reports')
          .update({ controll: controllName })
          .eq('id', reportId);
        if (error) throw error;
        if (existingReport && !wasAlreadyConfirmed) {
          await applyProfileBookingDelta(existingReport.profile_id, getReportBookingDelta(existingReport, 1));
        }
      }
      await loadData();
    });
  } catch (error) {
    console.error(error);
    alert(`Kontrolle konnte nicht gespeichert werden: ${error.message}`);
  } finally {
    state.isSavingReport = false;
    render();
  }
}

async function handleConfirmHolidayRequest(requestId, fieldName, roleLabel) {
  if (!requestId || state.isSavingAbsence) {
    return;
  }

  const shouldConfirm = window.confirm('Bist du sicher, dass du die Ferien bestätigen möchtest?');
  if (!shouldConfirm) {
    return;
  }

  const approvalName = getApprovalDisplayName();
  if (!approvalName) {
    alert(`Der Name für die Bestätigung ${roleLabel} konnte nicht ermittelt werden.`);
    return;
  }

  state.isSavingAbsence = true;
  try {
    await withLongTask('Absenzbestätigung wird verarbeitet …', async () => {
      const updates = { [fieldName]: approvalName };
      const request = state.holidayRequests.find((item) => String(item.id) === String(requestId));

      if (state.isDemoMode) {
        updateDemoHolidayRequest(requestId, updates);
        const updatedRequest = demoHolidayRequests.find((item) => String(item.id) === String(requestId));
        if (isHolidayRequestFullyApproved(updatedRequest)) {
          await createAutoReportsForApprovedHolidayRequest(updatedRequest);
          archiveDemoHolidayRequestDecision(updatedRequest, buildApprovedHolidayRequestContext(updatedRequest));
          deleteDemoHolidayRequest(requestId);
        }
      } else {
        let updatedRequest = request ? { ...request, ...updates } : null;
        const { error } = await state.supabase.rpc('approve_holiday_request', {
          p_request_id: requestId,
          p_field_name: fieldName,
          p_approval_name: approvalName,
        });

        if (error) {
          if (!request || !isMissingRpcFunctionError(error, 'approve_holiday_request')) {
            throw error;
          }

          updatedRequest = await approveHolidayRequestWithoutRpc(request, fieldName, approvalName);
        }

        if (request && isHolidayRequestFullyApproved(updatedRequest)) {
          await createAutoReportsForApprovedHolidayRequest(updatedRequest);
          await deleteHolidayRequestAttachmentsSafely(request.attachments);
        }
      }

      await loadData();
    });
  } catch (error) {
    console.error(error);
    alert(`Bestätigung ${roleLabel} konnte nicht gespeichert werden: ${error.message}`);
  } finally {
    state.isSavingAbsence = false;
    render();
  }
}

async function handleRejectHolidayRequest(requestId) {
  if (!requestId || state.isSavingAbsence) {
    return;
  }

  const request = state.holidayRequests.find((item) => String(item.id) === String(requestId));
  if (!request) {
    alert('Das ausgewählte Absenzgesuch wurde nicht gefunden.');
    return;
  }

  const shouldDelete = window.confirm('Soll dieses Absenzgesuch wirklich abgelehnt und gelöscht werden?');
  if (!shouldDelete) {
    return;
  }

  state.isSavingAbsence = true;
  try {
    if (state.isDemoMode) {
      archiveDemoHolidayRequestDecision(request, buildRejectedHolidayRequestContext(request));
      deleteDemoHolidayRequest(requestId);
    } else {
      const rejectionContext = buildRejectedHolidayRequestContext(request);
      const { error } = await state.supabase.rpc('reject_holiday_request', {
        p_request_id: requestId,
        p_context: rejectionContext,
      });

      if (error) {
        if (!isMissingRpcFunctionError(error, 'reject_holiday_request')) {
          throw error;
        }

        await rejectHolidayRequestWithoutRpc(request, rejectionContext);
      }

      await deleteHolidayRequestAttachmentsSafely(request.attachments);
    }

    await loadData();
  } catch (error) {
    console.error(error);
    alert(`Absenzgesuch konnte nicht abgelehnt werden: ${error.message}`);
  } finally {
    state.isSavingAbsence = false;
    render();
  }
}

function openReportEditModal(reportId) {
  const report = state.weeklyReports.find((item) => String(item.id) === String(reportId));
  if (!report) {
    return;
  }

  const profile = getProfileById(report.profile_id);
  state.editingReportId = report.id;
  elements.editReportId.value = report.id;
  elements.editEmployeeName.value = profile?.full_name ?? 'Unbekannt';
  elements.editWorkDate.value = report.work_date || '';
  elements.editCommissionNumber.value = report.commission_number || '';
  elements.editStartTime.value = normalizeTimeForInput(report.start_time);
  elements.editEndTime.value = normalizeTimeForInput(report.end_time);
  elements.editTotalMinutes.value = Number(report.total_work_minutes || 0);
  elements.editExpensesAmount.value = Number(report.expenses_amount || 0);
  elements.editOtherCostsAmount.value = Number(report.other_costs_amount || 0);
  elements.editNotes.value = report.notes || '';
  const pauseMinutes = Number(report.lunch_break_minutes || 0) + Number(report.additional_break_minutes || 0);
  state.editingReportPauseMinutes = pauseMinutes;
  elements.editPauseMinutes.value = pauseMinutes;
  if (elements.reportEditAttachments) {
    elements.reportEditAttachments.innerHTML = renderAttachmentLinks(report.attachments);
  }
  elements.reportEditModal.classList.remove('hidden');
}

function closeReportEditModal() {
  state.editingReportId = null;
  state.editingReportPauseMinutes = 0;
  if (!elements.reportEditModal || !elements.reportEditForm) {
    return;
  }

  elements.reportEditModal.classList.add('hidden');
  elements.reportEditForm.reset();
  if (elements.reportEditAttachments) {
    elements.reportEditAttachments.innerHTML = '';
  }
}

function openAdjustedMinutesModal(reportId) {
  const report = state.weeklyReports.find((item) => String(item.id) === String(reportId));
  if (!report || !elements.adjustedMinutesModal) {
    return;
  }

  state.editingAdjustedReportId = report.id;
  elements.adjustedReportId.value = report.id;
  elements.adjustedMinutesInput.value = Number(getAdjustedWorkMinutes(report));
  elements.adjustedMinutesModal.classList.remove('hidden');
}

function closeAdjustedMinutesModal() {
  state.editingAdjustedReportId = null;
  if (!elements.adjustedMinutesModal || !elements.adjustedMinutesForm) {
    return;
  }
  elements.adjustedMinutesModal.classList.add('hidden');
  elements.adjustedMinutesForm.reset();
}

async function handleAdjustedMinutesSubmit(event) {
  event.preventDefault();
  if (!state.editingAdjustedReportId || state.isSavingReport) {
    return;
  }

  const reportId = state.editingAdjustedReportId;
  const report = state.weeklyReports.find((item) => String(item.id) === String(reportId));
  if (!report) {
    closeAdjustedMinutesModal();
    return;
  }

  const adjustedMinutes = Math.max(0, Number(elements.adjustedMinutesInput.value || 0));
  const wasConfirmed = Boolean(String(report.controll || '').trim());
  const baseAdjustedMinutes = shouldApplyHolidayDoubleMinutes(report) ? Math.round(adjustedMinutes / 2) : adjustedMinutes;
  const updates = buildAdjustedMinutesUpdatePayload(report, baseAdjustedMinutes);
  if (wasConfirmed) {
    updates.controll = '';
  }
  state.isSavingReport = true;

  try {
    if (state.isDemoMode) {
      updateDemoReport(reportId, updates);
      if (wasConfirmed) {
        applyDemoReportBookingDelta(report, -1);
      }
    } else {
      const { error } = await state.supabase.from('weekly_reports').update(updates).eq('id', reportId);
      if (error) throw error;
      if (wasConfirmed) {
        await applyProfileBookingDelta(report.profile_id, getReportBookingDelta(report, -1));
      }
    }

    await loadData();
    closeAdjustedMinutesModal();
  } catch (error) {
    console.error(error);
    alert(`Bereinigte Arbeitszeit konnte nicht gespeichert werden: ${error.message}`);
  } finally {
    state.isSavingReport = false;
    render();
  }
}

function syncEditedWorkMinutesWithTimeRange() {
  const startMinutes = parseTimeToMinutes(elements.editStartTime.value);
  const endMinutes = parseTimeToMinutes(elements.editEndTime.value);
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
    return;
  }

  let durationMinutes = endMinutes - startMinutes;
  if (durationMinutes < 0) {
    durationMinutes += 24 * 60;
  }
  const pauseMinutes = Math.max(0, Number(elements.editPauseMinutes.value || 0));
  state.editingReportPauseMinutes = pauseMinutes;
  const workMinutes = Math.max(0, durationMinutes - pauseMinutes);
  elements.editTotalMinutes.value = String(workMinutes);
}

async function handleReportEditSubmit(event) {
  event.preventDefault();
  if (!state.editingReportId || state.isSavingReport) {
    return;
  }

  const reportId = state.editingReportId;
  const existingReport = state.weeklyReports.find((item) => String(item.id) === String(reportId));
  const wasConfirmed = Boolean(String(existingReport?.controll || '').trim());
  syncEditedWorkMinutesWithTimeRange();
  const totalWorkMinutes = Math.max(0, Number(elements.editTotalMinutes.value || 0));
  const pauseMinutes = Math.max(0, Number(elements.editPauseMinutes.value || 0));
  const baseAdjustedMinutes = shouldApplyHolidayDoubleMinutes(existingReport)
    ? Math.round(totalWorkMinutes / 2)
    : totalWorkMinutes;
  const updates = {
    work_date: elements.editWorkDate.value,
    ...getIsoYearAndWeekFromDateString(elements.editWorkDate.value),
    commission_number: elements.editCommissionNumber.value.trim(),
    start_time: elements.editStartTime.value,
    end_time: elements.editEndTime.value,
    lunch_break_minutes: pauseMinutes,
    additional_break_minutes: 0,
    total_work_minutes: totalWorkMinutes,
    ...buildAdjustedMinutesUpdatePayload(existingReport, baseAdjustedMinutes),
    expenses_amount: Number(elements.editExpensesAmount.value || 0),
    other_costs_amount: Number(elements.editOtherCostsAmount.value || 0),
    notes: elements.editNotes.value.trim(),
  };
  if (wasConfirmed) {
    updates.controll = '';
  }

  state.isSavingReport = true;
  try {
    if (state.isDemoMode) {
      updateDemoReport(reportId, updates);
      if (wasConfirmed && existingReport) {
        applyDemoReportBookingDelta(existingReport, -1);
      }
    } else {
      const { error } = await state.supabase.from('weekly_reports').update(updates).eq('id', reportId);
      if (error) throw error;
      if (wasConfirmed && existingReport) {
        await applyProfileBookingDelta(existingReport.profile_id, getReportBookingDelta(existingReport, -1));
      }
    }

    await loadData();
    closeReportEditModal();
  } catch (error) {
    console.error(error);
    alert(`Rapport konnte nicht aktualisiert werden: ${error.message}`);
  } finally {
    state.isSavingReport = false;
    render();
  }
}

async function handleDeleteReport(reportId) {
  if (!reportId || state.isSavingReport) {
    return;
  }

  const report = state.weeklyReports.find((item) => String(item.id) === String(reportId));
  if (!report) {
    alert('Der ausgewählte Rapport wurde nicht gefunden.');
    return;
  }

  const shouldDelete = window.confirm('Soll dieser Wochenrapport wirklich gelöscht werden?');
  if (!shouldDelete) {
    return;
  }

  const wasConfirmed = Boolean(String(report.controll || '').trim());
  state.isSavingReport = true;
  try {
    if (state.isDemoMode) {
      const index = demoWeeklyReports.findIndex((item) => String(item.id) === String(reportId));
      if (index === -1) {
        throw new Error('Demo-Rapport nicht gefunden');
      }
      const [deletedDemoReport] = demoWeeklyReports.splice(index, 1);
      if (wasConfirmed) {
        applyDemoReportBookingDelta(deletedDemoReport, -1);
      }
    } else {
      await deleteWeeklyReportAttachmentsSafely(report.attachments);
      const { error } = await state.supabase.from('weekly_reports').delete().eq('id', reportId);
      if (error) throw error;
      if (wasConfirmed) {
        await applyProfileBookingDelta(report.profile_id, getReportBookingDelta(report, -1));
      }
    }

    await loadData();
  } catch (error) {
    console.error(error);
    alert(`Rapport konnte nicht gelöscht werden: ${error.message}`);
  } finally {
    state.isSavingReport = false;
    render();
  }
}

async function handleSaveSaldoProfile(profileId) {
  if (!profileId || state.isSavingSaldo) {
    return;
  }

  const vacationAllowanceValue = getSaldoInputValue(profileId, 'vacation_allowance_hours');
  const carryoverOvertimeValue = getSaldoInputValue(profileId, 'carryover_overtime_hours');
  const creditedHoursValue = getSaldoInputValue(profileId, 'credited_hours');
  const weeklyHoursValue = getSaldoInputValue(profileId, 'weekly_hours');

  const updates = {
    vacation_allowance_hours: vacationAllowanceValue,
    carryover_overtime_hours: carryoverOvertimeValue,
    credited_hours: creditedHoursValue,
    weekly_hours: weeklyHoursValue > 0 ? weeklyHoursValue : 40,
  };

  state.isSavingSaldo = true;
  try {
    if (state.isDemoMode) {
      const profile = demoProfiles.find((item) => String(item.id) === String(profileId));
      if (!profile) {
        throw new Error('Demo-Profil nicht gefunden');
      }
      Object.assign(profile, updates);
    } else {
      const { error } = await state.supabase.from('app_profiles').update(updates).eq('id', profileId);
      if (error) throw error;
    }

    await loadData();
  } catch (error) {
    console.error(error);
    alert(`Saldo konnte nicht gespeichert werden: ${error.message}`);
  } finally {
    state.isSavingSaldo = false;
    render();
  }
}

async function synchronizeAllApprenticeSchoolReportsForYear(year) {
  const apprentices = state.profiles.filter((profile) => String(profile.role_label || '').trim() === 'Lehrling');
  for (const apprentice of apprentices) {
    // eslint-disable-next-line no-await-in-loop
    await synchronizeApprenticeSchoolReportsForYear(apprentice.id, year);
  }
}

function getSchoolReportSyncYears() {
  const years = new Set();
  const currentYear = new Date().getUTCFullYear();
  years.add(currentYear);
  years.add(currentYear + 1);
  const selectedWeekYear = Number(getYearAndWeekFromWeekValue(state.selectedWeek).year);
  if (Number.isInteger(selectedWeekYear)) {
    years.add(selectedWeekYear);
  }
  state.schoolVacations.forEach((range) => {
    const startYear = Number(String(range?.start_date || '').slice(0, 4));
    const endYear = Number(String(range?.end_date || '').slice(0, 4));
    if (Number.isInteger(startYear)) years.add(startYear);
    if (Number.isInteger(endYear)) years.add(endYear);
  });
  return [...years].sort((left, right) => left - right);
}

async function synchronizeAllApprenticeSchoolReportsForYears(years = []) {
  for (const year of years) {
    // eslint-disable-next-line no-await-in-loop
    await synchronizeAllApprenticeSchoolReportsForYear(year);
  }
}

async function synchronizeApprenticeSchoolReportsForYears(profileId, years = []) {
  for (const year of years) {
    // eslint-disable-next-line no-await-in-loop
    await synchronizeApprenticeSchoolReportsForYear(profileId, year);
  }
}

async function synchronizeApprenticeSchoolReportsForYear(profileId, year) {
  const profile = state.profiles.find((item) => String(item.id) === String(profileId))
    || demoProfiles.find((item) => String(item.id) === String(profileId));
  if (!profile) return;

  const schoolDays = [Number(profile.school_day_1), Number(profile.school_day_2)]
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 5);
  const isApprentice = String(profile.role_label || '') === 'Lehrling';
  const desiredDates = new Set();
  if (isApprentice && schoolDays.length) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    const cursor = new Date(`${startDate}T00:00:00Z`);
    const stop = new Date(`${endDate}T00:00:00Z`);
    while (cursor <= stop) {
      const isoDate = cursor.toISOString().slice(0, 10);
      const weekday = getWeekdayIndex(isoDate) + 1;
      if (schoolDays.includes(weekday) && !isDateInSchoolVacation(isoDate)) {
        desiredDates.add(isoDate);
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  let profileReports = [];
  if (state.isDemoMode) {
    profileReports = demoWeeklyReports.filter((report) => report.profile_id === profileId && Number(getIsoYearAndWeekFromDateString(report.work_date).year) === year);
  } else {
    const { data, error } = await state.supabase
      .from('weekly_reports')
      .select('*')
      .eq('profile_id', profileId)
      .eq('year', year);
    if (error) throw error;
    profileReports = data || [];
  }

  const autoSchoolReports = profileReports.filter(isAutoSchoolReport);
  const manualReportDates = new Set(profileReports.filter((report) => !isAutoSchoolReport(report)).map((report) => report.work_date));
  const blockDayDates = new Set(profileReports.filter((report) => isAutoBlockDayReport(report)).map((report) => report.work_date));
  const existingAutoDates = new Set(autoSchoolReports.map((report) => report.work_date));
  const holidayDates = new Set(state.platformHolidays.map((entry) => String(entry.holiday_date || '')));
  profileReports.forEach((report) => {
    if (Number(report.abz_typ) === 5 && report.work_date) {
      holidayDates.add(String(report.work_date));
    }
  });
  const datesToInsert = [...desiredDates].filter(
    (date) => !manualReportDates.has(date) && !existingAutoDates.has(date) && !holidayDates.has(date) && !blockDayDates.has(date),
  );
  const reportsToDeleteIds = autoSchoolReports.filter((report) => !desiredDates.has(report.work_date)).map((report) => report.id);

  if (datesToInsert.length) {
    const rows = datesToInsert.map((workDate) => {
      const isoWeek = getIsoYearAndWeekFromDateString(workDate);
      return {
        profile_id: profileId,
        work_date: workDate,
        year: isoWeek.year,
        kw: isoWeek.kw,
        project_name: 'Berufsschule',
        commission_number: 'Berufsschule',
        abz_typ: 7,
        start_time: '07:00',
        end_time: '16:30',
        lunch_break_minutes: 60,
        additional_break_minutes: 30,
        total_work_minutes: 480,
        adjusted_work_minutes: 480,
        expenses_amount: 0,
        other_costs_amount: 0,
        expense_note: '',
        notes: SCHOOL_REPORT_NOTE_MARKER,
        controll: '',
        attachments: [],
      };
    });
    if (state.isDemoMode) {
      rows.forEach((row) => demoWeeklyReports.push({ id: crypto.randomUUID(), ...row }));
    } else {
      const { error } = await state.supabase.from('weekly_reports').insert(rows);
      if (error) throw error;
    }
  }

  if (reportsToDeleteIds.length) {
    if (state.isDemoMode) {
      for (const reportId of reportsToDeleteIds) {
        const index = demoWeeklyReports.findIndex((item) => String(item.id) === String(reportId));
        if (index >= 0) demoWeeklyReports.splice(index, 1);
      }
    } else {
      const { error } = await state.supabase.from('weekly_reports').delete().in('id', reportsToDeleteIds);
      if (error) throw error;
    }
  }
}

async function synchronizeBlockDayReportsForYear(profileId, year) {
  let profileReports = [];
  if (state.isDemoMode) {
    profileReports = demoWeeklyReports.filter((report) => report.profile_id === profileId && Number(getIsoYearAndWeekFromDateString(report.work_date).year) === year);
  } else {
    const { data, error } = await state.supabase
      .from('weekly_reports')
      .select('*')
      .eq('profile_id', profileId)
      .eq('year', year);
    if (error) throw error;
    profileReports = data || [];
  }

  const idsToDelete = profileReports.filter((report) => isAutoBlockDayReport(report)).map((report) => report.id);
  if (idsToDelete.length) {
    if (state.isDemoMode) {
      for (const reportId of idsToDelete) {
        const index = demoWeeklyReports.findIndex((item) => String(item.id) === String(reportId));
        if (index >= 0) demoWeeklyReports.splice(index, 1);
      }
    } else {
      const { error } = await state.supabase.from('weekly_reports').delete().in('id', idsToDelete);
      if (error) throw error;
    }
  }
}

function getBlockDayModeFromReport(report) {
  const match = String(report?.notes || '').match(/\((full|am|pm)\)/);
  if (match?.[1]) return match[1];
  const startTime = String(report?.start_time || '').slice(0, 5);
  if (startTime === '07:00' && String(report?.end_time || '').slice(0, 5) === '12:00') return 'am';
  if (startTime === '13:00') return 'pm';
  return 'full';
}

function isAutoBlockDayReport(report) {
  return Number(report?.abz_typ) === BLOCK_DAY_TYPE_CODE && String(report?.notes || '').includes(BLOCK_DAY_REPORT_NOTE_MARKER);
}

function isAutoSchoolReport(report) {
  return Number(report?.abz_typ) === 7 && String(report?.notes || '').includes(SCHOOL_REPORT_NOTE_MARKER);
}

function isDateInSchoolVacation(date) {
  return state.schoolVacations.some((range) => date >= String(range.start_date || '') && date <= String(range.end_date || ''));
}

function updateDemoReport(reportId, updates) {
  const report = demoWeeklyReports.find((item) => item.id === reportId);
  if (!report) {
    throw new Error('Demo-Rapport nicht gefunden');
  }

  Object.assign(report, updates);
}

function updateDemoHolidayRequest(requestId, updates) {
  const request = demoHolidayRequests.find((item) => item.id === requestId);
  if (!request) {
    throw new Error('Demo-Absenz nicht gefunden');
  }

  Object.assign(request, updates);
}

function deleteDemoHolidayRequest(requestId) {
  const requestIndex = demoHolidayRequests.findIndex((item) => item.id === requestId);
  if (requestIndex === -1) {
    throw new Error('Demo-Absenz nicht gefunden');
  }

  demoHolidayRequests.splice(requestIndex, 1);
}

function archiveDemoHolidayRequestDecision(request, context) {
  if (!request) {
    throw new Error('Demo-Absenz nicht gefunden');
  }

  demoRequestHistory.unshift({
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    profile_id: request.profile_id,
    request: buildHolidayRequestArchiveSummary(request),
    context,
  });
}

function extractFirstName(value) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return '';
  }

  const [firstName] = normalizedValue.split(/\s+/);
  return firstName || '';
}

function getControllDisplayName() {
  const fullName = extractFirstName(state.currentProfile?.full_name);
  if (fullName) {
    return fullName;
  }

  const userMetadataName = extractFirstName(state.user?.user_metadata?.full_name || state.user?.user_metadata?.name);
  if (userMetadataName) {
    return userMetadataName;
  }

  const emailName = String(state.user?.email || '').trim().split('@')[0];
  return extractFirstName(emailName);
}

function getApprovalDisplayName() {
  const fullName = String(state.currentProfile?.full_name || '').trim();
  if (fullName) {
    return fullName;
  }

  const userMetadataName = String(state.user?.user_metadata?.full_name || state.user?.user_metadata?.name || '').trim();
  if (userMetadataName) {
    return userMetadataName;
  }

  return String(state.user?.email || '').trim().split('@')[0];
}

function buildHolidayRequestArchiveSummary(request) {
  if (!request) {
    return 'Absenzantrag';
  }

  const parts = [
    getAbsenceTypeLabel(request, request.request_type ?? 'Absenzantrag'),
    request.start_date && request.end_date ? `${formatDate(request.start_date)} bis ${formatDate(request.end_date)}` : '',
    String(request.notes || '').trim(),
  ].filter(Boolean);

  return parts.join(' | ');
}

function buildApprovedHolidayRequestContext(request) {
  const plLabel = String(request?.controll_pl || '').trim() || '–';
  const glLabel = String(request?.controll_gl || '').trim() || '–';
  return `Bestätigt durch PL: ${plLabel} | GL: ${glLabel}`;
}

function buildRejectedHolidayRequestContext() {
  return 'Abgelehnt und aus der aktuellen Liste entfernt';
}

function isMissingRpcFunctionError(error, functionName) {
  const message = String(error?.message || '');
  return error?.code === 'PGRST202' || message.includes(`Could not find the function public.${functionName}`);
}

function isMissingTableError(error, tableName) {
  const message = String(error?.message || '').toLowerCase();
  const normalizedTable = String(tableName || '').toLowerCase();
  return (
    error?.code === 'PGRST205' ||
    message.includes(`relation "${normalizedTable}" does not exist`) ||
    message.includes(`could not find the table 'public.${normalizedTable}' in the schema cache`) ||
    message.includes(`could not find the table '${normalizedTable}' in the schema cache`)
  );
}

async function insertHolidayRequestHistoryEntry(request, context) {
  const { error } = await state.supabase.from('request_history').insert({
    profile_id: request.profile_id,
    request: buildHolidayRequestArchiveSummary(request),
    context,
  });

  if (error) {
    throw error;
  }
}

async function approveHolidayRequestWithoutRpc(request, fieldName, approvalName) {
  const { data: updatedRequest, error: updateError } = await state.supabase
    .from('holiday_requests')
    .update({ [fieldName]: approvalName })
    .eq('id', request.id)
    .select()
    .single();

  if (updateError) {
    throw updateError;
  }

  if (isHolidayRequestFullyApproved(updatedRequest)) {
    await insertHolidayRequestHistoryEntry(updatedRequest, buildApprovedHolidayRequestContext(updatedRequest));

    const { error: deleteError } = await state.supabase
      .from('holiday_requests')
      .delete()
      .eq('id', updatedRequest.id);

    if (deleteError) {
      throw deleteError;
    }
  }

  return updatedRequest;
}

async function rejectHolidayRequestWithoutRpc(request, context) {
  await insertHolidayRequestHistoryEntry(request, context);

  const { error } = await state.supabase
    .from('holiday_requests')
    .delete()
    .eq('id', request.id);

  if (error) {
    throw error;
  }
}

function renderControllCell(report) {
  const controllValue = String(report.controll || '').trim();
  if (controllValue) {
    return `<div class="status-stack"><span class="pill success">Kontrolliert</span><strong>${escapeHtml(controllValue)}</strong></div>`;
  }

  return `<button class="button button-small button-success" type="button" data-action="confirm-report" data-report-id="${escapeAttribute(report.id)}" ${state.isSavingReport ? 'disabled' : ''}>Bestätigen</button>`;
}

function renderHolidayApprovalCell(request, fieldName, roleLabel) {
  const approvalValue = String(request?.[fieldName] || '').trim();
  if (approvalValue) {
    return `<div class="status-stack compact"><span class="pill success">Bestätigt</span><strong>${escapeHtml(approvalValue)}</strong></div>`;
  }

  return `
    <div class="status-stack compact">
      <button class="button button-small button-success" type="button" data-action="confirm-absence-${escapeAttribute(roleLabel.toLowerCase())}" data-request-id="${escapeAttribute(request.id)}" ${state.isSavingAbsence ? 'disabled' : ''}>Bestätigung ${escapeHtml(roleLabel)}</button>
    </div>
  `;
}

function renderHolidayRejectCell(request) {
  if (isHolidayRequestFullyApproved(request)) {
    return '<span class="subtle-text">—</span>';
  }
  return `<button class="button button-small button-danger" type="button" data-action="reject-absence-request" data-request-id="${escapeAttribute(request.id)}" ${state.isSavingAbsence ? 'disabled' : ''}>Ablehnen</button>`;
}

function renderHolidayConfirmationCell(request) {
  if (!isHolidayRequestFullyApproved(request)) {
    const hasAnyApproval = Boolean(String(request?.controll_pl || '').trim() || String(request?.controll_gl || '').trim());
    if (hasAnyApproval) {
      return `
        <div class="status-stack compact">
          <span class="subtle-text">PDF verfügbar nach PL- und GL-Bestätigung</span>
          <button class="button button-small button-danger" type="button" data-action="reject-absence-request" data-request-id="${escapeAttribute(request.id)}" ${state.isSavingAbsence ? 'disabled' : ''}>Gesuch ablehnen/löschen</button>
        </div>
      `;
    }

    return `<button class="button button-small button-danger" type="button" data-action="reject-absence-request" data-request-id="${escapeAttribute(request.id)}" ${state.isSavingAbsence ? 'disabled' : ''}>Gesuch ablehnen/löschen</button>`;
  }

  return `<button class="button button-small button-secondary" type="button" data-action="download-absence-confirmation" data-request-id="${escapeAttribute(request.id)}">PDF herunterladen</button>`;
}

function renderHistoryActionsCell(entry) {
  return `
    <div class="table-row-actions">
      <button class="button button-small button-secondary" type="button" data-action="download-history-confirmation" data-history-entry-id="${escapeAttribute(entry.id)}">PDF export</button>
      <button class="button button-small button-danger" type="button" data-action="delete-history-entry" data-history-entry-id="${escapeAttribute(entry.id)}" ${state.isSavingConfirmation ? 'disabled' : ''}>Löschen</button>
    </div>
  `;
}

function renderCrmContactsTable() {
  if (!elements.crmContactsTableBody) return;
  if (elements.crmSearchInput) {
    elements.crmSearchInput.value = state.crmSearchQuery;
  }
  if (elements.crmCategoryFilterInput) {
    elements.crmCategoryFilterInput.value = state.crmCategoryFilter;
  }
  const rows = getFilteredCrmContacts().sort((left, right) => `${left.last_name || ''} ${left.first_name || ''}`.localeCompare(`${right.last_name || ''} ${right.first_name || ''}`, 'de'));
  if (!rows.length) {
    elements.crmContactsTableBody.innerHTML = '<tr><td colspan="7">Keine Kontakte für den gewählten Filter gefunden.</td></tr>';
    return;
  }

  elements.crmContactsTableBody.innerHTML = rows.map((contact) => {
    const categoryLabel = CRM_CATEGORY_LABELS[String(contact.category || '').toLowerCase()] || contact.category || '—';
    return `<tr class="crm-row-clickable" data-action="open-crm-contact" data-contact-id="${escapeAttribute(contact.id)}">
      <td>${escapeHtml(categoryLabel)}</td>
      <td>${escapeHtml(contact.company_name || '—')}</td>
      <td>${escapeHtml(contact.first_name || '')}</td>
      <td>${escapeHtml(contact.last_name || '')}</td>
      <td>${escapeHtml(contact.phone || '—')}</td>
      <td>${escapeHtml(contact.email || '—')}</td>
      <td>
        <div class="table-row-actions">
          <button class="button button-small button-secondary" type="button" data-action="edit-crm-contact" data-contact-id="${escapeAttribute(contact.id)}">Bearbeiten</button>
          <button class="button button-small button-danger" type="button" data-action="delete-crm-contact" data-contact-id="${escapeAttribute(contact.id)}">Löschen</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderCrmNotesPanel() {
  if (!elements.crmNotesList || !elements.crmNotesHeader || !elements.crmNoteTargetUidInput) return;
  const selectedContact = state.crmContacts.find((entry) => String(entry.id) === String(state.selectedCrmContactId));
  if (!selectedContact) {
    elements.crmNotesHeader.textContent = 'Kein Kontakt ausgewählt.';
    elements.crmNoteTargetUidInput.value = '';
    elements.crmNotesList.innerHTML = '<li class="subtle-text">Wähle einen Kontakt aus der Tabelle aus.</li>';
    return;
  }

  const displayName = `${selectedContact.first_name || ''} ${selectedContact.last_name || ''}`.trim();
  elements.crmNotesHeader.textContent = `Notizen für ${displayName || selectedContact.id}${selectedContact.company_name ? ` · ${selectedContact.company_name}` : ''}`;
  elements.crmNoteTargetUidInput.value = selectedContact.id;

  const notes = state.crmNotes
    .filter((note) => String(note.target_uid) === String(selectedContact.id))
    .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')));
  if (!notes.length) {
    elements.crmNotesList.innerHTML = '<li class="subtle-text">Noch keine Notiz vorhanden.</li>';
    return;
  }

  elements.crmNotesList.innerHTML = notes.map((note) => `
    <li class="status-item">
      <div>
        <strong>${escapeHtml(formatDateTime(note.created_at))}</strong>
        <div>${escapeHtml(note.note_text || '')}</div>
      </div>
    </li>
  `).join('');
}

function renderCrmContactDetail() {
  if (!elements.crmContactListView || !elements.crmContactDetailView || !elements.crmContactDetailInfo) return;
  const selectedContact = state.crmContacts.find((entry) => String(entry.id) === String(state.selectedCrmContactId));
  const hasSelection = Boolean(selectedContact);
  elements.crmContactListView.classList.toggle('hidden', hasSelection);
  elements.crmContactDetailView.classList.toggle('hidden', !hasSelection);
  if (!selectedContact) {
    elements.crmContactDetailInfo.innerHTML = '';
    return;
  }

  const categoryLabel = CRM_CATEGORY_LABELS[selectedContact.category] || selectedContact.category || '—';
  elements.crmContactDetailInfo.innerHTML = `
    <dl>
      <dt>Kategorie</dt><dd>${escapeHtml(categoryLabel)}</dd>
      <dt>Firma</dt><dd>${escapeHtml(selectedContact.company_name || '—')}</dd>
      <dt>Vorname</dt><dd>${escapeHtml(selectedContact.first_name || '—')}</dd>
      <dt>Nachname</dt><dd>${escapeHtml(selectedContact.last_name || '—')}</dd>
      <dt>Strasse</dt><dd>${escapeHtml(selectedContact.street || '—')}</dd>
      <dt>Ort</dt><dd>${escapeHtml(selectedContact.city || '—')}</dd>
      <dt>PLZ</dt><dd>${escapeHtml(selectedContact.postal_code || '—')}</dd>
      <dt>Telefon</dt><dd>${escapeHtml(selectedContact.phone || '—')}</dd>
      <dt>E-Mail</dt><dd>${escapeHtml(selectedContact.email || '—')}</dd>
    </dl>
  `;
}

function openCrmContactModal(contact = null) {
  if (!elements.crmContactModal) return;
  elements.crmContactModal.classList.remove('hidden');
  if (!contact) {
    if (elements.crmContactForm) {
      elements.crmContactForm.reset();
    }
    if (elements.crmContactIdInput) {
      elements.crmContactIdInput.value = '';
    }
    return;
  }

  elements.crmContactIdInput.value = contact.id || '';
  elements.crmCategoryInput.value = contact.category || 'kunde';
  elements.crmCompanyInput.value = contact.company_name || '';
  elements.crmFirstNameInput.value = contact.first_name || '';
  elements.crmLastNameInput.value = contact.last_name || '';
  elements.crmStreetInput.value = contact.street || '';
  elements.crmCityInput.value = contact.city || '';
  elements.crmPostalCodeInput.value = contact.postal_code || '';
  elements.crmPhoneInput.value = contact.phone || '';
  elements.crmEmailInput.value = contact.email || '';
}

function closeCrmContactModal() {
  if (!elements.crmContactModal) return;
  elements.crmContactModal.classList.add('hidden');
}

function closeCrmContactDetail() {
  state.selectedCrmContactId = null;
  renderCrmContactsTable();
  renderCrmContactDetail();
  renderCrmNotesPanel();
}

function getFilteredCrmContacts() {
  return state.crmContacts.filter((contact) => {
    const category = String(contact.category || '').trim().toLowerCase();
    if (state.crmCategoryFilter && category !== state.crmCategoryFilter) {
      return false;
    }
    if (!state.crmSearchQuery) {
      return true;
    }
    const haystack = [
      contact.company_name || '',
      contact.first_name || '',
      contact.last_name || '',
    ].join(' ').toLowerCase();
    return haystack.includes(state.crmSearchQuery);
  });
}

function renderSettingsUsersTable() {
  if (!elements.settingsUsersTableBody) return;
  if (!state.profiles.length) {
    elements.settingsUsersTableBody.innerHTML = '<tr><td colspan="8">Keine Benutzer gefunden.</td></tr>';
    return;
  }

  const sortedProfiles = [...state.profiles].sort((left, right) => `${left.full_name || ''}`.localeCompare(`${right.full_name || ''}`, 'de'));
  elements.settingsUsersTableBody.innerHTML = sortedProfiles.map((profile) => {
    const isActive = profile.is_active !== false;
    const isOwnProfile = String(profile.id) === String(state.currentProfile?.id);
    const isApprentice = String(profile.role_label || '') === 'Lehrling';
    const roleOptions = APP_ROLE_OPTIONS.includes(String(profile.role_label || ''))
      ? APP_ROLE_OPTIONS
      : [...APP_ROLE_OPTIONS, String(profile.role_label || 'Benutzer')];
    return `<tr>
      <td>${escapeHtml(profile.full_name || '–')}</td>
      <td>${escapeHtml(profile.email || '–')}</td>
      <td>
        <select data-role-label-input="${escapeAttribute(profile.id)}" ${state.isSavingSettings ? 'disabled' : ''}>
          ${roleOptions.map((role) => `<option value="${escapeAttribute(role)}" ${String(profile.role_label || '') === role ? 'selected' : ''}>${escapeHtml(role)}</option>`).join('')}
        </select>
      </td>
      <td>
        <select data-school-day-input="${escapeAttribute(profile.id)}" ${state.isSavingSettings || !isApprentice ? 'disabled' : ''}>
          <option value="">–</option>
          ${SCHOOL_DAY_OPTIONS.map((option) => {
            const selected = Number(profile.school_day_1) === option.value;
            return `<option value="${option.value}" ${selected ? 'selected' : ''}>${escapeHtml(option.label)}</option>`;
          }).join('')}
        </select>
      </td>
      <td>
        <div class="stacked-cell">
          <button class="button button-small button-secondary" type="button" data-action="edit-block-days" data-block-days-input="${escapeAttribute(profile.id)}" data-profile-id="${escapeAttribute(profile.id)}" ${state.isSavingSettings ? 'disabled' : ''}>Blocktage</button>
          <small class="subtle-text">${escapeHtml(getBlockScheduleSummary(profile))}</small>
        </div>
      </td>
      <td>
        <input
          type="number"
          min="0"
          step="0.01"
          value="${escapeAttribute(Number(profile.target_revenue || 0).toFixed(2))}"
          data-target-revenue-input="${escapeAttribute(profile.id)}"
          ${state.isSavingSettings ? 'disabled' : ''}
        />
      </td>
      <td><span class="pill ${isActive ? 'success' : 'warning'}">${isActive ? 'Aktiv' : 'Deaktiviert'}</span></td>
      <td>
        <div class="table-row-actions">
          ${isActive ? `<button class="button button-small button-primary" type="button" data-action="save-user-settings" data-profile-id="${escapeAttribute(profile.id)}" ${state.isSavingSettings ? 'disabled' : ''}>Speichern</button>` : `<button class="button button-small button-danger" type="button" data-action="purge-user-account" data-profile-id="${escapeAttribute(profile.id)}" ${state.isSavingSettings || isOwnProfile ? 'disabled' : ''}>Restlos löschen</button>`}
          <button class="button button-small ${isActive ? 'button-danger' : 'button-secondary'}" type="button" data-action="toggle-user-active" data-profile-id="${escapeAttribute(profile.id)}" ${state.isSavingSettings || isOwnProfile ? 'disabled' : ''}>
            ${isActive ? 'Deaktivieren' : 'Aktivieren'}
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderSettingsHolidaysTable() {
  if (!elements.settingsHolidaysTableBody) return;
  const rows = [...state.platformHolidays].sort((a, b) => `${a.holiday_date || ''}`.localeCompare(`${b.holiday_date || ''}`));
  if (!rows.length) {
    elements.settingsHolidaysTableBody.innerHTML = '<tr><td colspan="4">Noch keine Feiertage erfasst.</td></tr>';
    return;
  }

  elements.settingsHolidaysTableBody.innerHTML = rows.map((entry) => {
    const isEditing = String(state.editingHolidayId) === String(entry.id);
    return `
      <tr>
        <td>${escapeHtml(formatDate(entry.holiday_date))}</td>
        <td>${escapeHtml(entry.label || 'Feiertag')}</td>
        <td>
          ${isEditing ? `
            <select data-holiday-paid-select="${escapeAttribute(entry.id)}" ${state.isSavingSettings ? 'disabled' : ''}>
              <option value="true" ${entry.is_paid === false ? '' : 'selected'}>Bezahlt</option>
              <option value="false" ${entry.is_paid === false ? 'selected' : ''}>Unbezahlt</option>
            </select>
          ` : (entry.is_paid === false ? 'Unbezahlt' : 'Bezahlt')}
        </td>
        <td>
          <div class="table-row-actions">
            ${isEditing ? `
              <button class="button button-small button-primary" type="button" data-action="save-edit-holiday" data-holiday-id="${escapeAttribute(entry.id)}" ${state.isSavingSettings ? 'disabled' : ''}>Speichern</button>
              <button class="button button-small button-secondary" type="button" data-action="cancel-edit-holiday" data-holiday-id="${escapeAttribute(entry.id)}" ${state.isSavingSettings ? 'disabled' : ''}>Abbrechen</button>
            ` : `
              <button class="button button-small button-secondary" type="button" data-action="start-edit-holiday" data-holiday-id="${escapeAttribute(entry.id)}" ${state.isSavingSettings ? 'disabled' : ''}>Bearbeiten</button>
              <button class="button button-small button-danger" type="button" data-action="delete-holiday" data-holiday-id="${escapeAttribute(entry.id)}" ${state.isSavingSettings ? 'disabled' : ''}>Entfernen</button>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderSettingsSchoolVacationsTable() {
  if (!elements.settingsSchoolVacationsTableBody) return;
  const rows = [...state.schoolVacations].sort((a, b) => `${a.start_date || ''}`.localeCompare(`${b.start_date || ''}`));
  if (!rows.length) {
    elements.settingsSchoolVacationsTableBody.innerHTML = '<tr><td colspan="3">Noch keine Ferienzeiten erfasst.</td></tr>';
    return;
  }
  elements.settingsSchoolVacationsTableBody.innerHTML = rows.map((entry) => `
    <tr>
      <td>${escapeHtml(formatDate(entry.start_date))}</td>
      <td>${escapeHtml(formatDate(entry.end_date))}</td>
      <td>
        <button class="button button-small button-danger" type="button" data-action="delete-school-vacation" data-school-vacation-id="${escapeAttribute(entry.id)}" ${state.isSavingSettings ? 'disabled' : ''}>
          Entfernen
        </button>
      </td>
    </tr>
  `).join('');
}

function renderProjectForm() {
  if (!elements.projectLeadSelect) return;
  const options = [`<option value="">Bitte wählen</option>`]
    .concat(
      getActiveProfiles().map((profile) => `<option value="${escapeAttribute(profile.id)}">${escapeHtml(profile.full_name || profile.email || 'Unbekannt')}</option>`)
    )
    .join('');
  elements.projectLeadSelect.innerHTML = options;
  elements.constructionLeadSelect.innerHTML = options;
}

function renderProjectsTable() {
  if (!elements.projectsTableBody) return;
  const rows = getFilteredProjects();
  if (!rows.length) {
    elements.projectsTableBody.innerHTML = '<tr><td colspan="6" class="empty-state">Keine Projekte vorhanden.</td></tr>';
    return;
  }
  elements.projectsTableBody.innerHTML = rows.map((project) => {
    const assignments = getProjectRoleAssignments(project.id);
    const projectLead = getProfileById(assignments.projectLeadId)?.full_name || '—';
    const constructionLead = getProfileById(assignments.constructionLeadId)?.full_name || '—';
    return `<tr class="project-row-clickable" data-action="open-project-detail" data-project-id="${escapeAttribute(project.id)}">
      <td>${escapeHtml(project.commission_number || '')}</td>
      <td>${escapeHtml(project.name || '')}</td>
      <td>${escapeHtml(projectLead)}</td>
      <td>${escapeHtml(constructionLead)}</td>
      <td><span class="pill ${project.allow_expenses === false ? 'warning' : 'success'}">${project.allow_expenses === false ? 'Nein' : 'Ja'}</span></td>
      <td>
        <div class="table-row-actions">
          <button class="button button-small button-secondary" type="button" data-action="edit-project" data-project-id="${escapeAttribute(project.id)}">Bearbeiten</button>
          <button class="button button-small button-danger" type="button" data-action="delete-project" data-project-id="${escapeAttribute(project.id)}">Löschen</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderDispoPlanner() {
  if (!elements.dispoTableBody) return;
  if (elements.dispoMultiEntryInput) {
    elements.dispoMultiEntryInput.checked = state.dispoAllowMultiplePerDay;
  }
  const weekRange = getWeekRange(state.selectedWeek);
  elements.dispoWeekLabel.textContent = getWeekLabel(state.selectedWeek);
  elements.dispoWeekDateRange.textContent = `${formatDate(weekRange.start)} – ${formatDate(weekRange.end)}`;
  const dates = getWeekDateList(state.selectedWeek);
  elements.dispoTableHead.innerHTML = `<tr><th>Mitarbeiter</th>${dates.map((date) => {
    const isWeekend = isWeekendDate(date);
    const hasEditableProfiles = getActiveProfiles().some((profile) => !isWeeklyReportLocked(profile.id, date));
    const bulkAssignButton = !isWeekend && hasEditableProfiles
      ? `<button class="button button-secondary button-icon-only" type="button" data-action="bulk-dispo-column" data-date="${escapeAttribute(date)}" title="Ganzer Tag disponieren" aria-label="Ganzer Tag disponieren">＋</button>`
      : '';
    return `<th><div class="dispo-header-cell">${escapeHtml(getWeekdayLabel(date))}<span class="subtle-text">${escapeHtml(formatDate(date))}</span>${bulkAssignButton}</div></th>`;
  }).join('')}</tr>`;
  const activeProfiles = getActiveProfiles();
  elements.dispoTableBody.innerHTML = activeProfiles.map((profile) => {
    const cells = dates.map((date) => renderDispoCell(profile.id, date)).join('');
    const hasEditableWeekdays = dates.some((date) => !isWeekendDate(date) && !isWeeklyReportLocked(profile.id, date));
    const bulkAssignRowButton = hasEditableWeekdays
      ? `<button class="button button-secondary button-icon-only" type="button" data-action="bulk-dispo-row" data-profile-id="${escapeAttribute(profile.id)}" title="Woche für Mitarbeiter disponieren" aria-label="Woche für Mitarbeiter disponieren">＋</button>`
      : '';
    return `<tr><td><div class="dispo-name-cell"><strong>${escapeHtml(profile.full_name || profile.email || 'Unbekannt')}</strong>${bulkAssignRowButton}</div></td>${cells}</tr>`;
  }).join('');
}

function renderDispoCell(profileId, date) {
  if (isWeekendDate(date)) {
    return '<td><div class="dispo-plus-cell"><span class="subtle-text">–</span></div></td>';
  }
  const blockItems = getBlockDayDispoItems(profileId, date);
  const hasFullDayBlock = blockItems.some((item) => {
    const start = toDispoMinutes(item.start_time, BLOCK_DAY_DEFAULT_START);
    const end = toDispoMinutes(item.end_time, BLOCK_DAY_DEFAULT_END);
    return start <= parseClockToMinutes(BLOCK_DAY_DEFAULT_START) && end >= parseClockToMinutes(BLOCK_DAY_DEFAULT_END);
  });
  const isLocked = isWeeklyReportLocked(profileId, date);
  const entry = state.dailyAssignments.find((item) => item.profile_id === profileId && item.assignment_date === date);
  const assignmentItems = getDispoItemsForEntry(entry);
  const weeklyReportItems = getWeeklyReportItems(profileId, date);
  const weeklyAbsenceItems = weeklyReportItems.filter((item) => isAbsenceDispoItem(item?.label));
  const fallbackItems = weeklyAbsenceItems.length ? weeklyAbsenceItems : (isLocked ? weeklyReportItems : []);
  const items = assignmentItems.length ? assignmentItems : fallbackItems;
  const hasAutoAbsenceFromWeeklyReport = !assignmentItems.length && weeklyAbsenceItems.length > 0;
  const addButton = (!hasFullDayBlock && !isLocked && !hasAutoAbsenceFromWeeklyReport)
    ? `<button class="button button-secondary button-icon-only" type="button" data-action="assign-dispo" data-profile-id="${escapeAttribute(profileId)}" data-date="${escapeAttribute(date)}" title="Dispo hinzufügen" aria-label="Dispo hinzufügen">＋</button>`
    : '';
  const blockTagBadges = blockItems.length
    ? `<div class="dispo-items">${blockItems.map((item) => `<div class="dispo-item-row"><span class="dispo-item-text">${escapeHtml(item.label)}</span></div>`).join('')}</div>`
    : '';
  if (!items.length) {
    if (!addButton) {
      return `<td><div class="dispo-cell dispo-cell-locked">${blockTagBadges}</div></td>`;
    }
    return `<td><div class="dispo-plus-cell">${blockTagBadges}${addButton}</div></td>`;
  }
  return `<td><div class="dispo-cell">
    ${blockTagBadges}
    <div class="dispo-items">${items.map((item, index) => renderDispoItemCard(item, entry?.id, index, !isLocked)).join('')}</div>
    ${state.dispoAllowMultiplePerDay && addButton ? `<div class="dispo-add-row">${addButton}</div>` : ''}
  </div></td>`;
}

function renderDispoItemCard(item, assignmentId, index, allowDelete = true) {
  const themeClass = getDispoCardThemeClass(item?.label);
  const lineLabel = getDispoItemLineLabel(item);
  const timeLabel = getDispoItemTimeLabel(item);
  const actions = allowDelete && assignmentId
    ? `<div class="dispo-item-actions">
      <button class="button button-icon-only dispo-delete-button" type="button" data-action="remove-dispo-item" data-assignment-id="${escapeAttribute(assignmentId)}" data-item-index="${escapeAttribute(index)}" title="Eintrag löschen">✕</button>
    </div>`
    : '';
  return `<article class="dispo-item-card ${themeClass}">
    <div class="dispo-item-text">
      <span>${escapeHtml(lineLabel)}</span>
      ${timeLabel ? `<small class="dispo-item-time">${escapeHtml(timeLabel)}</small>` : ''}
    </div>
    ${actions}
  </article>`;
}

function getDispoCardThemeClass(label) {
  const normalized = normalizeSearchValue(label || '');
  if (normalized.includes('divers')) return 'dispo-item-card-dark';
  if (normalized.includes('feiertag') || normalized.includes('ferien')) return 'dispo-item-card-red';
  if (normalized.includes('krankheit') || normalized.includes('unfall')) return 'dispo-item-card-orange';
  if (normalized.includes('militaer') || normalized.includes('zivildienst')) return 'dispo-item-card-green';
  return '';
}

function getDispoItemLineLabel(item) {
  return item?.label || '';
}

function getDispoItemTimeLabel(item) {
  if (isAbsenceDispoItem(item?.label)) return '';
  const startTime = normalizeDispoTimeValue(item?.start_time, DISPO_DEFAULT_START_TIME);
  const endTime = normalizeDispoTimeValue(item?.end_time, DISPO_DEFAULT_END_TIME);
  return `${startTime} – ${endTime}`;
}

function normalizeDispoTimeValue(value, fallback) {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  return raw.slice(0, 5);
}

function openDispoGapSearchModal() {
  if (!elements.dispoGapSearchModal) return;
  const serviceProfiles = getServiceProfiles();
  const currentWeek = state.selectedWeek || getCurrentWeekValue();
  if (elements.dispoGapWeekFromInput) elements.dispoGapWeekFromInput.value = currentWeek;
  if (elements.dispoGapWeekToInput) elements.dispoGapWeekToInput.value = '';
  if (elements.dispoGapMinimumHoursInput) elements.dispoGapMinimumHoursInput.value = '4';
  if (elements.dispoGapServiceProfiles) {
    elements.dispoGapServiceProfiles.textContent = serviceProfiles.length
      ? `Service-Mitarbeitende (${serviceProfiles.length}): ${serviceProfiles.map((profile) => profile.full_name || profile.email || 'Unbekannt').join(', ')}`
      : 'Keine aktiven Mitarbeitenden mit Rolle „Service“ gefunden.';
  }
  if (elements.dispoGapModalResults) {
    elements.dispoGapModalResults.innerHTML = '';
    elements.dispoGapModalResults.classList.add('hidden');
  }
  elements.dispoGapSearchModal.classList.remove('hidden');
}

function closeDispoGapSearchModal() {
  if (!elements.dispoGapSearchModal) return;
  elements.dispoGapSearchModal.classList.add('hidden');
  if (elements.dispoGapModalResults) {
    elements.dispoGapModalResults.innerHTML = '';
    elements.dispoGapModalResults.classList.add('hidden');
  }
}

async function handleDispoGapSearchSubmit(event) {
  event.preventDefault();
  try {
    const serviceProfiles = getServiceProfiles();
    if (!serviceProfiles.length) {
      showInlineAlert(elements.dispoAlert, 'Keine aktiven Personen mit Rolle „Service“ vorhanden.', true);
      return;
    }
    const weekFrom = normalizeWeekInput(elements.dispoGapWeekFromInput?.value);
    if (!weekFrom) {
      showInlineAlert(elements.dispoAlert, 'Bitte eine gültige Kalenderwoche bei „Von“ eingeben.', true);
      return;
    }
    const weekToInput = normalizeWeekInput(elements.dispoGapWeekToInput?.value);
    const weekTo = weekToInput || weekFrom;
    const weekValues = getWeekValueRange(weekFrom, weekTo);
    if (!weekValues) {
      showInlineAlert(elements.dispoAlert, 'Die Kalenderwoche „Bis“ muss gleich oder nach „Von“ liegen.', true);
      return;
    }
    if (weekValues.length > 3) {
      showInlineAlert(elements.dispoAlert, 'Es können maximal 3 Kalenderwochen gleichzeitig gesucht werden.', true);
      return;
    }
    const minimumHours = Number(String(elements.dispoGapMinimumHoursInput?.value || '').replace(',', '.'));
    if (!Number.isFinite(minimumHours) || minimumHours <= 0) {
      showInlineAlert(elements.dispoAlert, 'Die Mindestlücke muss grösser als 0 Stunden sein.', true);
      return;
    }
    const minimumMinutes = Math.round(minimumHours * 60);
    const searchRange = getWeekRangeAcrossValues(weekValues);
    const assignmentEntries = await fetchDispoAssignmentsForRange(searchRange.start, searchRange.end);
    const matches = findDispoAvailabilityGaps({
      weekValues,
      windowStartMinutes: parseClockToMinutes('07:00'),
      windowEndMinutes: parseClockToMinutes('17:00'),
      minimumGapMinutes: minimumMinutes,
      profiles: serviceProfiles,
      assignmentEntries,
    });
    const resultPayload = {
      matches,
      weekLabel: weekValues.length === 1 ? getWeekLabel(weekValues[0]) : `${getWeekLabel(weekValues[0])} bis ${getWeekLabel(weekValues[weekValues.length - 1])}`,
      minimumHours,
      windowLabel: '07:00 – 17:00',
    };
    renderDispoGapSearchResults(resultPayload, elements.dispoGapResults);
    renderDispoGapSearchResults(resultPayload, elements.dispoGapModalResults);
    showInlineAlert(elements.dispoAlert, `Lückensuche für ${weekValues.length} KW abgeschlossen (${matches.length} Treffer).`, false);
  } catch (error) {
    showInlineAlert(elements.dispoAlert, `Lückensuche fehlgeschlagen: ${error.message}`, true);
  }
}

function parseDispoGapTimeWindow(inputValue) {
  const raw = String(inputValue || '').trim().replace(/\s+/g, '');
  const match = raw.match(/^(\d{1,2}(?::\d{2})?)-(\d{1,2}(?::\d{2})?)$/);
  if (!match) return null;
  const startMinutes = parseClockToMinutes(match[1]);
  const endMinutes = parseClockToMinutes(match[2]);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return null;
  return { startMinutes, endMinutes };
}

function parseClockToMinutes(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parts = raw.split(':');
  const hours = Number(parts[0]);
  const minutes = parts.length > 1 ? Number(parts[1]) : 0;
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return (hours * 60) + minutes;
}

function minutesToTimeLabel(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function normalizeWeekInput(inputValue) {
  const match = String(inputValue || '').trim().match(/^(\d{4})-W(\d{1,2})$/i);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(week) || week < 1 || week > 53) return null;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function findDispoAvailabilityGaps({
  weekValues,
  windowStartMinutes,
  windowEndMinutes,
  minimumGapMinutes,
  profiles,
  assignmentEntries,
}) {
  const dates = weekValues.flatMap((weekValue) => getWeekDateList(weekValue)).filter((date) => !isWeekendDate(date));
  const matches = [];
  for (const profile of profiles) {
    for (const date of dates) {
      const busyIntervals = getBusyIntervalsForProfileDate(profile.id, date, windowStartMinutes, windowEndMinutes, assignmentEntries);
      const freeIntervals = computeFreeIntervals(windowStartMinutes, windowEndMinutes, busyIntervals)
        .filter((interval) => (interval.end - interval.start) >= minimumGapMinutes);
      for (const interval of freeIntervals) {
        matches.push({
          profileName: profile.full_name || profile.email || 'Unbekannt',
          date,
          start: interval.start,
          end: interval.end,
          isFullDay: interval.start === windowStartMinutes && interval.end === windowEndMinutes,
        });
      }
    }
  }
  return matches.sort((left, right) => {
    if (left.date !== right.date) return left.date.localeCompare(right.date);
    if (left.profileName !== right.profileName) return left.profileName.localeCompare(right.profileName, 'de');
    return left.start - right.start;
  });
}

function getBusyIntervalsForProfileDate(profileId, date, windowStartMinutes, windowEndMinutes, assignmentEntries = state.dailyAssignments) {
  const entry = assignmentEntries.find((item) => item.profile_id === profileId && item.assignment_date === date);
  const blockItems = getBlockDayDispoItems(profileId, date);
  const assignmentItems = getDispoItemsForEntry(entry);
  const busyItems = [...blockItems, ...assignmentItems];
  const intervals = busyItems
    .map((item) => {
      const start = toDispoMinutes(item.start_time, DISPO_DEFAULT_START_TIME);
      const end = toDispoMinutes(item.end_time, DISPO_DEFAULT_END_TIME);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
      const clippedStart = Math.max(start, windowStartMinutes);
      const clippedEnd = Math.min(end, windowEndMinutes);
      if (clippedEnd <= clippedStart) return null;
      return { start: clippedStart, end: clippedEnd };
    })
    .filter(Boolean)
    .sort((left, right) => left.start - right.start);
  return mergeIntervals(intervals);
}

function mergeIntervals(intervals) {
  if (!intervals.length) return [];
  const merged = [{ ...intervals[0] }];
  for (let index = 1; index < intervals.length; index += 1) {
    const current = intervals[index];
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

function computeFreeIntervals(windowStartMinutes, windowEndMinutes, busyIntervals) {
  if (!busyIntervals.length) {
    return [{ start: windowStartMinutes, end: windowEndMinutes }];
  }
  const freeIntervals = [];
  let cursor = windowStartMinutes;
  for (const interval of busyIntervals) {
    if (interval.start > cursor) {
      freeIntervals.push({ start: cursor, end: interval.start });
    }
    cursor = Math.max(cursor, interval.end);
    if (cursor >= windowEndMinutes) break;
  }
  if (cursor < windowEndMinutes) {
    freeIntervals.push({ start: cursor, end: windowEndMinutes });
  }
  return freeIntervals;
}

function renderDispoGapSearchResults({ matches, weekLabel, minimumHours, windowLabel }, targetElement = elements.dispoGapResults) {
  if (!targetElement) return;
  targetElement.classList.remove('hidden');
  if (!matches.length) {
    targetElement.innerHTML = `<h4>Freie Lücken (${escapeHtml(weekLabel)})</h4>
      <p class="subtle-text">Keine freien Zeitfenster ≥ ${escapeHtml(String(minimumHours))}h im Bereich ${escapeHtml(windowLabel)} gefunden.</p>`;
    return;
  }
  const rows = matches
    .map((match) => `<li><strong>${escapeHtml(match.profileName)}</strong> – ${escapeHtml(getWeekdayLabel(match.date))}, ${escapeHtml(formatDate(match.date))}: ${
      match.isFullDay ? 'Ganzer Tag frei' : `${escapeHtml(minutesToTimeLabel(match.start))} – ${escapeHtml(minutesToTimeLabel(match.end))} frei`
    }</li>`)
    .join('');
  targetElement.innerHTML = `<h4>Freie Lücken (${escapeHtml(weekLabel)})</h4>
    <p class="subtle-text">Zeitfenster: ${escapeHtml(windowLabel)} · Mindestlücke: ${escapeHtml(String(minimumHours))}h</p>
    <ul>${rows}</ul>`;
}

function getServiceProfiles() {
  return getActiveProfiles().filter((profile) => String(profile.role_label || '').trim() === 'Service');
}

function getWeekValueRange(weekFrom, weekTo) {
  const fromRange = getWeekRange(weekFrom);
  const toRange = getWeekRange(weekTo);
  if (toRange.start < fromRange.start) return null;
  const values = [weekFrom];
  let cursor = weekFrom;
  while (cursor !== weekTo) {
    const next = shiftWeekValue(cursor, 1);
    if (next === cursor || values.length > 53) return null;
    cursor = next;
    values.push(cursor);
  }
  return values;
}

function getWeekRangeAcrossValues(weekValues) {
  const firstRange = getWeekRange(weekValues[0]);
  const lastRange = getWeekRange(weekValues[weekValues.length - 1]);
  return { start: firstRange.start, end: lastRange.end };
}

async function fetchDispoAssignmentsForRange(startDate, endDate) {
  if (!state.supabase) return [];
  const [dailyAssignmentsResponse, weeklyReportsResponse] = await Promise.all([
    state.supabase
      .from('daily_assignments')
      .select('*')
      .gte('assignment_date', startDate)
      .lte('assignment_date', endDate)
      .order('assignment_date', { ascending: true }),
    state.supabase
      .from('weekly_reports')
      .select('*')
      .gte('work_date', startDate)
      .lte('work_date', endDate)
      .order('work_date', { ascending: true }),
  ]);
  const { data: dailyAssignments, error: dailyAssignmentsError } = dailyAssignmentsResponse;
  const { data: weeklyReports, error: weeklyReportsError } = weeklyReportsResponse;
  if (dailyAssignmentsError && !isMissingTableError(dailyAssignmentsError, 'daily_assignments')) {
    throw dailyAssignmentsError;
  }
  if (weeklyReportsError) {
    throw weeklyReportsError;
  }
  const profileMap = new Map(state.profiles.map((profile) => [String(profile.id), profile]));
  const projectMap = new Map(state.projects.map((project) => [String(project.id), project]));
  const merged = [...(dailyAssignments || [])];
  const byKey = new Map(merged.map((entry) => [`${entry.profile_id}:${entry.assignment_date}`, entry]));
  for (const report of weeklyReports || []) {
    const key = `${report.profile_id}:${report.work_date}`;
    if (byKey.has(key)) continue;
    const projectId = resolveProjectIdFromReportWithMap(report, projectMap);
    if (!projectId) continue;
    const project = projectMap.get(String(projectId));
    const serialized = serializeDispoItems([{
      type: 'project',
      project_id: projectId,
      label: `${project?.commission_number || report.commission_number || ''} ${project?.name || report.project_name || ''}`.trim(),
      start_time: normalizeDispoTimeValue(report.start_time, DISPO_DEFAULT_START_TIME),
      end_time: normalizeDispoTimeValue(report.end_time, DISPO_DEFAULT_END_TIME),
    }]);
    const profile = profileMap.get(String(report.profile_id));
    if (profile?.is_active === false) continue;
    const entry = { id: `weekly-${key}`, profile_id: report.profile_id, assignment_date: report.work_date, label: serialized, source: 'weekly_report' };
    byKey.set(key, entry);
    merged.push(entry);
  }
  return merged;
}

function resolveProjectIdFromReportWithMap(report, projectMap) {
  const byCommission = [...projectMap.values()].find((project) => String(project.commission_number || '').trim() === String(report.commission_number || '').trim());
  if (byCommission) return byCommission.id;
  const byName = [...projectMap.values()].find((project) => String(project.name || '').trim().toLowerCase() === String(report.project_name || '').trim().toLowerCase());
  if (byName) return byName.id;
  return null;
}

function isAbsenceDispoItem(label) {
  const normalized = normalizeSearchValue(label || '');
  return ['ferien', 'feiertag', 'krankheit', 'unfall', 'militaer', 'zivildienst', 'berufsschule', 'blocktag', 'absenz'].some((term) => normalized.includes(term));
}

function getBlockDayDispoItems(profileId, date) {
  const profile = getProfileById(profileId);
  const schedule = parseBlockSchedule(profile);
  if (!schedule.length) return [];
  const weekday = getWeekdayIndex(date) + 1;
  return schedule
    .filter((entry) => entry.weekday === weekday)
    .map((entry) => ({
      start_time: normalizeDispoTimeValue(entry.start_time, BLOCK_DAY_DEFAULT_START),
      end_time: normalizeDispoTimeValue(entry.end_time, BLOCK_DAY_DEFAULT_END),
      label: `Blocktag (${normalizeDispoTimeValue(entry.start_time, BLOCK_DAY_DEFAULT_START)}–${normalizeDispoTimeValue(entry.end_time, BLOCK_DAY_DEFAULT_END)})`,
    }));
}

function toDispoMinutes(timeValue, fallback) {
  const value = normalizeDispoTimeValue(timeValue, fallback);
  const [hh, mm] = value.split(':').map((part) => Number(part));
  return (hh * 60) + mm;
}

function hasBlockDayOverlap(profileId, date, items = []) {
  const blockItems = getBlockDayDispoItems(profileId, date);
  if (!blockItems.length || !items.length) return false;
  return items.some((item) => {
    const itemStart = toDispoMinutes(item.start_time, DISPO_DEFAULT_START_TIME);
    const itemEnd = toDispoMinutes(item.end_time, DISPO_DEFAULT_END_TIME);
    if (itemEnd <= itemStart) return true;
    return blockItems.some((block) => {
      const blockStart = toDispoMinutes(block.start_time, BLOCK_DAY_DEFAULT_START);
      const blockEnd = toDispoMinutes(block.end_time, BLOCK_DAY_DEFAULT_END);
      return itemStart < blockEnd && itemEnd > blockStart;
    });
  });
}

function isPastDispoDate(date) {
  const todayIso = new Date().toISOString().slice(0, 10);
  return String(date || '') < todayIso;
}

function upsertLocalDailyAssignment(entry) {
  if (!entry) return;
  const index = state.dailyAssignments.findIndex((item) => item.profile_id === entry.profile_id && item.assignment_date === entry.assignment_date);
  if (index >= 0) {
    state.dailyAssignments[index] = entry;
    return;
  }
  state.dailyAssignments.push(entry);
}

function removeLocalDailyAssignment(profileId, date) {
  state.dailyAssignments = state.dailyAssignments.filter((item) => !(item.profile_id === profileId && item.assignment_date === date));
}

function serializeDispoItems(items = []) {
  const normalizedItems = items
    .filter((item) => item && typeof item.label === 'string' && item.label.trim())
    .map((item) => {
      const normalized = {
        label: item.label.trim(),
        start_time: normalizeDispoTimeValue(item.start_time, DISPO_DEFAULT_START_TIME),
        end_time: normalizeDispoTimeValue(item.end_time, DISPO_DEFAULT_END_TIME),
      };
      if (item.project_id) normalized.project_id = item.project_id;
      return normalized;
    });
  return `${DISPO_ITEMS_PREFIX}${JSON.stringify(normalizedItems)}`;
}

function getDispoItemsForEntry(entry) {
  if (!entry) return [];
  if (typeof entry.label === 'string' && (entry.label.startsWith(DISPO_ITEMS_PREFIX) || entry.label.startsWith(DISPO_ITEMS_LEGACY_PREFIX))) {
    const prefix = entry.label.startsWith(DISPO_ITEMS_PREFIX) ? DISPO_ITEMS_PREFIX : DISPO_ITEMS_LEGACY_PREFIX;
    try {
      const parsed = JSON.parse(entry.label.slice(prefix.length));
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item && typeof item.label === 'string' && item.label.trim())
          .map((item) => ({
            ...item,
            start_time: normalizeDispoTimeValue(item.start_time, DISPO_DEFAULT_START_TIME),
            end_time: normalizeDispoTimeValue(item.end_time, DISPO_DEFAULT_END_TIME),
          }));
      }
    } catch (error) {
      console.warn('Ungültige Dispo-Liste', error);
    }
  }
  const project = entry.project_id ? state.projects.find((item) => item.id === entry.project_id) : null;
  const label = project ? `${project.commission_number || ''} ${project.name || ''}`.trim() : (entry.label || '');
  return label ? [{
    type: project ? 'project' : 'special',
    project_id: project?.id || null,
    label,
    start_time: DISPO_DEFAULT_START_TIME,
    end_time: DISPO_DEFAULT_END_TIME,
  }] : [];
}

function getFilteredProjects() {
  const query = state.projectSearchQuery.trim().toLowerCase();
  if (!query) return [...state.projects];
  return state.projects.filter((project) => String(project.commission_number || '').toLowerCase().includes(query) || String(project.name || '').toLowerCase().includes(query));
}

function getProjectRoleAssignments(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  return {
    projectLeadId: project?.project_lead_profile_id || '',
    constructionLeadId: project?.construction_lead_profile_id || '',
  };
}

function handleProjectSearchInput(event) {
  state.projectSearchQuery = event.target.value || '';
  renderProjectsTable();
}

async function handleProjectSubmit(event) {
  event.preventDefault();
  const commissionNumber = elements.projectCommissionInput.value.trim();
  const name = elements.projectNameInput.value.trim();
  const projectLeadId = elements.projectLeadSelect.value;
  const constructionLeadId = elements.constructionLeadSelect.value;
  const allowExpenses = elements.projectExpensesAllowedInput?.checked !== false;
  if (!commissionNumber || !name || !projectLeadId || !constructionLeadId) {
    showInlineAlert(elements.projectsAlert, 'Kommissionsnummer, Projektname, Projektleiter und Bauleiter sind Pflicht.', true);
    return;
  }
  if (projectLeadId === constructionLeadId) {
    showInlineAlert(elements.projectsAlert, 'Projektleiter und Bauleiter müssen unterschiedliche Personen sein.', true);
    return;
  }
  await withLongTask('Projekt wird gespeichert …', async () => {
    const payload = {
      commission_number: commissionNumber,
      name,
      project_lead_profile_id: projectLeadId,
      construction_lead_profile_id: constructionLeadId,
      allow_expenses: allowExpenses,
    };
    let projectId = state.editingProjectId;
    if (projectId) {
      const { error } = await state.supabase.from('projects').update(payload).eq('id', projectId);
      if (error) throw error;
    } else {
      const { data, error } = await state.supabase.from('projects').insert(payload).select('id').single();
      if (error) throw error;
      projectId = data.id;
    }
    resetProjectForm();
    closeProjectModal();
    showInlineAlert(elements.projectsAlert, 'Projekt erfolgreich gespeichert.', false);
    await loadData();
  });
}

function resetProjectForm() {
  state.editingProjectId = null;
  elements.projectIdInput.value = '';
  elements.projectCommissionInput.value = '';
  elements.projectNameInput.value = '';
  elements.projectLeadSelect.value = '';
  elements.constructionLeadSelect.value = '';
  if (elements.projectExpensesAllowedInput) {
    elements.projectExpensesAllowedInput.checked = true;
  }
}

async function handleProjectsTableClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    const row = event.target.closest('tr[data-action="open-project-detail"]');
    if (row && !event.target.closest('a, button, input, select, textarea')) {
      openProjectDetail(row.dataset.projectId);
    }
    return;
  }
  const action = button.dataset.action;
  const projectId = button.dataset.projectId;
  if (action === 'edit-project') {
    const project = state.projects.find((item) => String(item.id) === String(projectId));
    if (!project) return;
    const roles = getProjectRoleAssignments(project.id);
    state.editingProjectId = project.id;
    elements.projectIdInput.value = project.id;
    elements.projectCommissionInput.value = project.commission_number || '';
    elements.projectNameInput.value = project.name || '';
    elements.projectLeadSelect.value = roles.projectLeadId;
    elements.constructionLeadSelect.value = roles.constructionLeadId;
    if (elements.projectExpensesAllowedInput) {
      elements.projectExpensesAllowedInput.checked = project.allow_expenses !== false;
    }
    openProjectModal();
    return;
  }
  if (action === 'delete-project') {
    if (!confirm('Projekt wirklich löschen?')) return;
    const { error } = await state.supabase.from('projects').delete().eq('id', projectId);
    if (error) {
      showInlineAlert(elements.projectsAlert, error.message, true);
      return;
    }
    showInlineAlert(elements.projectsAlert, 'Projekt gelöscht.', false);
    await loadData();
  }
}

function openProjectModal() {
  if (!elements.projectModal) return;
  elements.projectModal.classList.remove('hidden');
}

function closeProjectModal() {
  if (!elements.projectModal) return;
  elements.projectModal.classList.add('hidden');
}

function openProjectDetail(projectId) {
  const project = state.projects.find((item) => String(item.id) === String(projectId));
  if (!project) return;
  const detailUrl = new URL('./project-detail.html', window.location.href);
  detailUrl.searchParams.set('projectId', String(project.id));
  detailUrl.searchParams.set('commission', project.commission_number || '');
  detailUrl.searchParams.set('name', project.name || '');
  window.location.href = detailUrl.toString();
}

function openCrmContactDetailPage(contact) {
  if (!contact?.id) return;
  const detailUrl = new URL('./crm-contact-detail.html', window.location.href);
  detailUrl.searchParams.set('contactId', String(contact.id));
  detailUrl.searchParams.set('firstName', contact.first_name || '');
  detailUrl.searchParams.set('lastName', contact.last_name || '');
  detailUrl.searchParams.set('company', contact.company_name || '');
  window.location.href = detailUrl.toString();
}

async function handleDispoTableClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  if (button.dataset.action === 'assign-dispo') {
    if (isWeeklyReportLocked(button.dataset.profileId, button.dataset.date)) {
      showInlineAlert(elements.dispoAlert, 'Vergangene Tage können in der Dispo nicht mehr bearbeitet werden.', true);
      return;
    }
    openDispoAssignModal({
      targets: [{ profileId: button.dataset.profileId, date: button.dataset.date }],
      label: `Mitarbeiter ${getProfileById(button.dataset.profileId)?.full_name || ''} · ${formatDate(button.dataset.date)}`,
    });
    return;
  }
  if (button.dataset.action === 'bulk-dispo-row') {
    const profileId = button.dataset.profileId;
    openDispoAssignModal({
      targets: getWeekDateList(state.selectedWeek)
        .filter((date) => !isWeekendDate(date))
        .filter((date) => !isWeeklyReportLocked(profileId, date))
        .map((date) => ({ profileId, date })),
      label: `Ganze Woche für ${getProfileById(profileId)?.full_name || ''}`,
    });
    return;
  }
  if (button.dataset.action === 'bulk-dispo-column') {
    const date = button.dataset.date;
    openDispoAssignModal({
      targets: getActiveProfiles()
        .filter((profile) => !isWeeklyReportLocked(profile.id, date))
        .map((profile) => ({ profileId: profile.id, date })),
      label: `Ganzer Tag ${getWeekdayLabel(date)} (${formatDate(date)})`,
    });
    return;
  }
  if (button.dataset.action === 'remove-dispo-item') {
    const entry = state.dailyAssignments.find((item) => String(item.id) === String(button.dataset.assignmentId));
    if (!entry) return;
    if (isWeeklyReportLocked(entry.profile_id, entry.assignment_date)) {
      showInlineAlert(elements.dispoAlert, 'Vergangene Tage können in der Dispo nicht mehr bearbeitet werden.', true);
      return;
    }
    const index = Number(button.dataset.itemIndex);
    const items = getDispoItemsForEntry(entry).filter((_, itemIndex) => itemIndex !== index);
    await saveDispoAssignment({
      profileId: entry.profile_id,
      date: entry.assignment_date,
      items,
      source: 'manual',
      mode: 'replace',
    });
    return;
  }
}

async function saveDispoAssignment({ profileId, date, items = [], source = 'manual', suppressReload = false, silent = false, mode = 'replace' }) {
  if (isWeeklyReportLocked(profileId, date)) {
    const message = 'Vergangene Tage können in der Dispo nicht mehr bearbeitet werden.';
    if (!silent) showInlineAlert(elements.dispoAlert, message, true);
    return { saved: false, error: message };
  }
  const existingEntry = state.dailyAssignments.find((item) => item.profile_id === profileId && item.assignment_date === date);
  const baseItems = mode === 'append' ? getDispoItemsForEntry(existingEntry) : [];
  const mergedItems = [...baseItems, ...items].filter((item) => item?.label);
  if (hasBlockDayOverlap(profileId, date, mergedItems)) {
    const message = 'Die Dispo-Zeit überschneidet sich mit einem Blocktag.';
    if (!silent) showInlineAlert(elements.dispoAlert, message, true);
    return { saved: false, error: message };
  }
  if (!mergedItems.length) {
    if (!state.isDemoMode && state.supabase) {
      const deleteQuery = state.supabase
        .from('daily_assignments')
        .delete()
        .eq('profile_id', profileId)
        .eq('assignment_date', date);
      const { error: deleteError } = await deleteQuery;
      if (deleteError && !isMissingTableError(deleteError, 'daily_assignments')) {
        if (!silent) showInlineAlert(elements.dispoAlert, `Dispo konnte nicht gelöscht werden: ${deleteError.message}`, true);
        return { saved: false, error: deleteError.message };
      }
    }
    removeLocalDailyAssignment(profileId, date);
    if (!silent || !suppressReload) renderDispoPlanner();
    return { saved: true, error: null };
  }
  const payload = {
    profile_id: profileId,
    assignment_date: date,
    project_id: mergedItems.find((item) => item?.project_id)?.project_id || null,
    label: serializeDispoItems(mergedItems),
    source,
  };
  if (!payload.project_id) {
    const message = 'Dispo braucht ein gültiges Projekt (project_id).';
    if (!silent) showInlineAlert(elements.dispoAlert, message, true);
    return { saved: false, error: message };
  }
  let entry = {
    id: existingEntry?.id || `local-${profileId}-${date}`,
    ...payload,
  };
  if (!state.isDemoMode && state.supabase) {
    const { data: savedEntry, error: upsertError } = await state.supabase
      .from('daily_assignments')
      .upsert(payload, { onConflict: 'profile_id,assignment_date' })
      .select()
      .single();
    if (upsertError) {
      if (!silent) showInlineAlert(elements.dispoAlert, `Beim Speichern ist ein Fehler aufgetreten: ${upsertError.message}`, true);
      return { saved: false, error: upsertError.message };
    }
    entry = savedEntry || entry;
  }
  upsertLocalDailyAssignment(entry);
  if (!silent || !suppressReload) renderDispoPlanner();
  if (!silent) showInlineAlert(elements.dispoAlert, 'Dispo gespeichert.', false);
  return { saved: true, error: null };
}

async function mergeWeeklyReportsIntoDispo(dailyAssignments) {
  const merged = [...dailyAssignments];
  const byKey = new Map(merged.map((entry) => [`${entry.profile_id}:${entry.assignment_date}`, entry]));
  const todayIso = new Date().toISOString().slice(0, 10);
  const weeklyGrouped = new Map();
  for (const report of state.weeklyReports) {
    const key = `${report.profile_id}:${report.work_date}`;
    if (!weeklyGrouped.has(key)) weeklyGrouped.set(key, []);
    weeklyGrouped.get(key).push(report);
  }
  for (const [key, entries] of weeklyGrouped.entries()) {
    const [profileId, date] = key.split(':');
    const existing = byKey.get(key);
    const isPastOrToday = date <= todayIso;
    if (existing && !isPastOrToday) continue;
    if (existing?.source === 'manual') continue;
    const computed = mapWeeklyReportToDispoEntry(profileId, date, entries);
    if (!computed) continue;
    const computedSerialized = serializeDispoItems(computed.items || []);
    if (existing && (existing.label || '') === computedSerialized) continue;
    await saveDispoAssignment({ profileId, date, items: computed.items || [], source: 'weekly_report', suppressReload: true, silent: true });
    const nextEntry = {
      ...(existing || { id: `pending-${key}` }),
      profile_id: profileId,
      assignment_date: date,
      project_id: computed.items?.[0]?.project_id || null,
      label: computedSerialized,
      source: 'weekly_report',
    };
    byKey.set(key, nextEntry);
    if (existing) {
      const index = merged.findIndex((item) => item.profile_id === profileId && item.assignment_date === date);
      if (index >= 0) merged[index] = nextEntry;
    } else {
      merged.push(nextEntry);
    }
  }
  return merged;
}

function mapWeeklyReportToDispoEntry(profileId, date, reports) {
  if (!reports?.length) return null;
  const mappedItems = reports
    .map((report) => mapReportToDispoItem(report))
    .filter(Boolean);
  if (!mappedItems.length) return null;
  return { items: [mappedItems[0]] };
}

function mapReportToDispoItem(report) {
  const projectId = resolveProjectIdFromReport(report);
  if (!projectId) return null;
  const project = state.projects.find((item) => item.id === projectId);
  return {
    type: 'project',
    project_id: projectId,
    label: `${project?.commission_number || report.commission_number || ''} ${project?.name || report.project_name || ''}`.trim(),
    start_time: normalizeDispoTimeValue(report.start_time, DISPO_DEFAULT_START_TIME),
    end_time: normalizeDispoTimeValue(report.end_time, DISPO_DEFAULT_END_TIME),
  };
}

function resolveProjectIdFromReport(report) {
  const byCommission = state.projects.find((project) => String(project.commission_number || '').trim() === String(report.commission_number || '').trim());
  if (byCommission) return byCommission.id;
  const byName = state.projects.find((project) => String(project.name || '').trim().toLowerCase() === String(report.project_name || '').trim().toLowerCase());
  return byName?.id || null;
}

function getWeeklyReportItems(profileId, date) {
  const reports = state.weeklyReports.filter((report) => report.profile_id === profileId && report.work_date === date);
  return reports.map((report) => ({
    type: 'weekly_report',
    project_id: resolveProjectIdFromReport(report),
    label: `${report.commission_number || ''} ${report.project_name || ''}`.trim() || 'Ohne Projekt',
    start_time: normalizeDispoTimeValue(report.start_time, DISPO_DEFAULT_START_TIME),
    end_time: normalizeDispoTimeValue(report.end_time, DISPO_DEFAULT_END_TIME),
  }));
}

function isWeeklyReportLocked(profileId, date) {
  return isPastDispoDate(date);
}

function getWeekDateList(weekValue) {
  const weekRange = getWeekRange(weekValue);
  const cursor = new Date(`${weekRange.start}T00:00:00Z`);
  const result = [];
  for (let i = 0; i < 7; i += 1) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

function isWeekendDate(date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function openDispoAssignModal({ targets, label }) {
  const editableTargets = (targets || []).filter((target) => !isWeeklyReportLocked(target.profileId, target.date));
  if (!editableTargets.length) {
    showInlineAlert(elements.dispoAlert, 'Vergangene Tage können in der Dispo nicht mehr bearbeitet werden.', true);
    return;
  }
  state.dispoAssignContext = { targets: editableTargets };
  elements.dispoAssignTargetLabel.textContent = label || 'Auswahl treffen.';
  const sortedProjects = [...state.projects].sort((left, right) => {
    const leftLabel = `${left.commission_number || ''} ${left.name || ''}`.trim().toLowerCase();
    const rightLabel = `${right.commission_number || ''} ${right.name || ''}`.trim().toLowerCase();
    return leftLabel.localeCompare(rightLabel, 'de');
  });
  elements.dispoAssignProjectsList.innerHTML = `<table class="dispo-select-table"><thead><tr><th>Projekte</th><th>Auswahl</th></tr></thead><tbody>${sortedProjects.map((project, index) => `<tr><td>${escapeHtml(`${project.commission_number || ''} ${project.name || ''}`.trim())}</td><td><input type="radio" name="dispoAssignChoice" value="project:${escapeAttribute(project.id)}" ${index === 0 ? 'checked' : ''} /></td></tr>`).join('')}</tbody></table>`;
  elements.dispoAssignSpecialList.innerHTML = '<p class="subtle-text">Nur Projekt-Zuweisungen verfügbar.</p>';
  elements.dispoAssignStartTime.value = DISPO_DEFAULT_START_TIME;
  elements.dispoAssignEndTime.value = DISPO_DEFAULT_END_TIME;
  if (!state.projects.length) {
    showInlineAlert(elements.dispoAlert, 'Keine Projekte vorhanden. Bitte zuerst ein Projekt erfassen.', true);
    return;
  }
  elements.dispoAssignModal.classList.remove('hidden');
}

function closeDispoAssignModal() {
  elements.dispoAssignModal.classList.add('hidden');
  state.dispoAssignContext = null;
  elements.dispoAssignForm.reset();
}

async function handleDispoAssignSubmit(event) {
  event.preventDefault();
  const targets = state.dispoAssignContext?.targets || [];
  if (!targets.length) return;
  const checked = elements.dispoAssignForm.querySelector('input[name="dispoAssignChoice"]:checked');
  if (!checked) {
    showInlineAlert(elements.dispoAlert, 'Bitte zuerst eine Zuweisung auswählen.', true);
    return;
  }
  const [type, rawValue] = checked.value.split(':');
  if (type !== 'project') {
    showInlineAlert(elements.dispoAlert, 'Nur Projekt-Zuweisungen sind erlaubt.', true);
    return;
  }
  const startTime = normalizeDispoTimeValue(elements.dispoAssignStartTime?.value, DISPO_DEFAULT_START_TIME);
  const endTime = normalizeDispoTimeValue(elements.dispoAssignEndTime?.value, DISPO_DEFAULT_END_TIME);
  const selectedProject = state.projects.find((project) => String(project.id) === String(rawValue));
  const item = { type: 'project', project_id: rawValue, label: `${selectedProject?.commission_number || ''} ${selectedProject?.name || ''}`.trim(), start_time: startTime, end_time: endTime };
  if (!item.label) {
    showInlineAlert(elements.dispoAlert, 'Projekt konnte nicht zugeordnet werden. Bitte Auswahl neu öffnen.', true);
    return;
  }
  const mode = state.dispoAllowMultiplePerDay ? 'append' : 'replace';
  const errorMessages = [];
  for (const target of targets) {
    const result = await saveDispoAssignment({ profileId: target.profileId, date: target.date, items: [item], mode, suppressReload: true, silent: true, source: 'manual' });
    if (!result.saved) errorMessages.push(result.error || 'Unbekannter Fehler');
  }
  if (errorMessages.length) {
    const uniqueErrors = [...new Set(errorMessages)];
    const details = uniqueErrors.join(' | ');
    showInlineAlert(elements.dispoAlert, `Beim Speichern ist ein Fehler aufgetreten: ${details}`, true);
    await loadData();
    return;
  }
  closeDispoAssignModal();
  showInlineAlert(elements.dispoAlert, 'Dispo gespeichert.', false);
  await loadData();
}

function showInlineAlert(element, message, isError = false) {
  if (!element) return;
  element.classList.remove('hidden');
  element.textContent = message;
  element.style.background = isError ? 'rgba(215, 0, 21, 0.08)' : 'rgba(19, 115, 51, 0.10)';
}

function handleGlobalKeydown(event) {
  if (event.key !== 'Escape') {
    return;
  }
  if (elements.adjustedMinutesModal && !elements.adjustedMinutesModal.classList.contains('hidden')) {
    closeAdjustedMinutesModal();
    return;
  }
  if (elements.dispoAssignModal && !elements.dispoAssignModal.classList.contains('hidden')) {
    closeDispoAssignModal();
    return;
  }
  if (elements.projectModal && !elements.projectModal.classList.contains('hidden')) {
    closeProjectModal();
    return;
  }
  if (elements.confirmationsModal && !elements.confirmationsModal.classList.contains('hidden')) {
    closeConfirmationsModal();
    return;
  }
  if (!elements.reportEditModal.classList.contains('hidden')) {
    closeReportEditModal();
  }
}

function openConfirmationsModal() {
  state.isConfirmationsModalOpen = true;
  renderConfirmationsModalState();
  renderConfirmationsTable();
}

function closeConfirmationsModal() {
  state.isConfirmationsModalOpen = false;
  renderConfirmationsModalState();
}

async function exportFilteredConfirmationsPdf() {
  const entries = getFilteredRequestHistory();
  if (!entries.length) {
    alert('Keine bestätigten Absenzen für den aktuellen Filter vorhanden.');
    return;
  }
  for (const entry of entries) {
    // eslint-disable-next-line no-await-in-loop
    await exportRequestHistoryPdf(entry.id, true);
  }
}

function setCurrentPage(page) {
  state.currentPage = page;
  render();
}

async function exportWeekPdf() {
  await withLongTask('PDF-Export wird vorbereitet …', async () => {
    const filteredReports = getSortedFilteredReports();
    if (!filteredReports.length) {
      alert('Für die gewählte Woche sind keine Rapporte vorhanden.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
    const grouped = groupReportsByProfile(filteredReports);
    const weekRange = getWeekRange(state.selectedWeek);
    let firstSection = true;

    for (const profile of getReportableProfiles().filter((item) => grouped.has(item.id))) {
      const reports = grouped.get(profile.id) ?? [];
      if (!firstSection) pdf.addPage();
      firstSection = false;

      const reportLayout = buildWeeklyReportLayout(reports);
      drawWeeklyReportPage(pdf, {
        profile,
        weekRange,
        calendarWeek: getWeekLabel(state.selectedWeek),
        layout: reportLayout,
      });

      const imageAttachments = reports
        .flatMap((report) => Array.isArray(report.attachments) ? report.attachments : [])
        .filter((attachment) => isImageAttachment(attachment) && getAttachmentUrl(attachment));
      for (let index = 0; index < imageAttachments.length; index += 2) {
        pdf.addPage();
        await drawAttachmentGalleryPage(pdf, imageAttachments.slice(index, index + 2), {
          profileName: profile.full_name || 'Unbekannt',
          calendarWeek: getWeekLabel(state.selectedWeek),
        });
      }
    }

    pdf.addPage();
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('Fehlende/Unvollständige Wochenrapporte', 14, 18);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(getWeekLabel(state.selectedWeek), 14, 24);
    const missingRows = getIncompleteSubmissionProfiles({ selectedOnly: true }).map((entry) => [
      entry.profile.full_name,
      entry.profile.email,
      entry.statusLabel,
    ]);
    pdf.autoTable({
      startY: 30,
      head: [['Mitarbeiter', 'E-Mail', 'Status']],
      body: missingRows.length ? missingRows : [['Alle Mitarbeiter haben vollständig abgegeben.', '', '']],
      styles: { fontSize: 9, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.2 },
      headStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255] },
    });

    pdf.save(`wochenrapport-${state.selectedWeek}.pdf`);
  });
}

async function exportDispoPdf() {
  await withLongTask('Dispo-PDF wird vorbereitet …', async () => {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      alert('PDF-Export ist aktuell nicht verfügbar.');
      return;
    }
    const dates = getWeekDateList(state.selectedWeek);
    const body = getActiveProfiles().map((profile) => {
      const row = [profile.full_name || profile.email || 'Unbekannt'];
      for (const date of dates) {
        const entry = state.dailyAssignments.find((item) => item.profile_id === profile.id && item.assignment_date === date);
        const labels = getDispoItemsForEntry(entry).map((item) => item.label);
        row.push(labels.join(' | '));
      }
      return row;
    });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
    const head = [['Mitarbeiter', ...dates.map((date) => `${getWeekdayLabel(date)} ${formatDate(date)}`)]];
    pdf.setFontSize(14);
    pdf.text(`Dispo ${getWeekLabel(state.selectedWeek)} (${formatDate(dates[0])} – ${formatDate(dates[6])})`, 14, 14);
    pdf.autoTable({
      startY: 20,
      head,
      body,
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: [39, 78, 183] },
    });
    pdf.save(`dispo-${state.selectedWeek}.pdf`);
  });
}


async function exportHolidayConfirmationPdf(requestId) {
  await withLongTask('Absenzbestätigung als PDF wird erstellt …', async () => {
    const request = state.holidayRequests.find((item) => String(item.id) === String(requestId));
    if (!request) {
      alert('Die ausgewählte Absenz wurde nicht gefunden.');
      return;
    }

    if (!isHolidayRequestFullyApproved(request)) {
      alert('Das Bestätigungsdokument kann erst heruntergeladen werden, wenn PL und GL bestätigt haben.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const profile = getProfileById(request.profile_id);

    drawHolidayConfirmationPage(pdf, { request, profile });

    const attachments = Array.isArray(request.attachments) ? request.attachments : [];
    const imageAttachments = attachments.filter((attachment) => isImageAttachment(attachment) && getAttachmentUrl(attachment));
    const otherAttachments = attachments.filter((attachment) => !isImageAttachment(attachment));

    if (otherAttachments.length) {
      pdf.addPage();
      drawHolidayAttachmentListPage(pdf, { attachments: otherAttachments, request, profile });
    }

    for (let index = 0; index < imageAttachments.length; index += 2) {
      pdf.addPage();
      await drawAttachmentGalleryPage(pdf, imageAttachments.slice(index, index + 2), {
        profileName: profile?.full_name || 'Unbekannt',
        calendarWeek: 'Absenz-Bestätigung',
      });
    }

    pdf.save(buildHolidayConfirmationFileName(request, profile));
  });
}

function buildRequestHistoryConfirmationFileName(entry, profile) {
  const createdDate = String(entry?.created_at || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const safeName = String(profile?.full_name || profile?.email || 'mitarbeiter')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return `bestaetigung-${safeName || 'mitarbeiter'}-${createdDate}.pdf`;
}

function buildHistoryPdfDetailRows(entry, details, profile) {
  return [
    ['Mitarbeiter', profile?.full_name || profile?.email || 'Unbekannt'],
    ['Typ', details.typeLabel],
    ['Von / Bis', details.periodLabel],
    ['Bestätigt durch', details.approvedByLabel],
    ['Ausgelöst am', formatDateTime(entry.created_at)],
    ['Kontext', String(entry?.context || '').trim() || '–'],
  ];
}

function drawRequestHistoryConfirmationPage(pdf, { entry, details, profile }) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const detailRows = buildHistoryPdfDetailRows(entry, details, profile);
  const requestText = String(entry?.request || '').trim() || '–';

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.text('Bestätigung Absenz', margin, 22);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10.5);
  pdf.text('Export aus request_history (Bestätigungen).', margin, 32, {
    maxWidth: contentWidth,
    lineHeightFactor: 1.4,
  });

  pdf.autoTable({
    startY: 42,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    head: [['Feld', 'Wert']],
    body: detailRows,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [215, 0, 21], textColor: [255, 255, 255] },
    columnStyles: { 0: { cellWidth: 42, fontStyle: 'bold' }, 1: { cellWidth: contentWidth - 42 } },
  });

  const notesY = (pdf.lastAutoTable?.finalY || 92) + 10;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('Gesuch', margin, notesY);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.rect(margin, notesY + 3, contentWidth, 40);
  pdf.text(requestText, margin + 3, notesY + 10, {
    maxWidth: contentWidth - 6,
    lineHeightFactor: 1.4,
  });
}

async function exportRequestHistoryPdf(historyEntryId) {
  await withLongTask('Bestätigung als PDF wird erstellt …', async () => {
    const entry = state.requestHistory.find((item) => String(item.id) === String(historyEntryId));
    if (!entry) {
      alert('Der ausgewählte Bestätigungseintrag wurde nicht gefunden.');
      return;
    }

    const details = parseRequestHistoryEntry(entry);
    const profile = getProfileById(entry.profile_id);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });

    drawRequestHistoryConfirmationPage(pdf, { entry, details, profile });
    pdf.save(buildRequestHistoryConfirmationFileName(entry, profile));
  });
}

async function handleDeleteHistoryEntry(historyEntryId) {
  if (!historyEntryId || state.isSavingConfirmation) {
    return;
  }

  const entry = state.requestHistory.find((item) => String(item.id) === String(historyEntryId));
  if (!entry) {
    alert('Der ausgewählte Bestätigungseintrag wurde nicht gefunden.');
    return;
  }

  const shouldDelete = window.confirm('Soll dieser Bestätigungseintrag wirklich gelöscht werden?');
  if (!shouldDelete) {
    return;
  }

  state.isSavingConfirmation = true;
  try {
    if (state.isDemoMode) {
      const index = demoRequestHistory.findIndex((item) => String(item.id) === String(historyEntryId));
      if (index === -1) {
        throw new Error('Demo-Bestätigung nicht gefunden');
      }
      demoRequestHistory.splice(index, 1);
    } else {
      const { error } = await state.supabase.from('request_history').delete().eq('id', historyEntryId);
      if (error) {
        throw error;
      }
    }

    await loadData();
  } catch (error) {
    console.error(error);
    alert(`Bestätigungseintrag konnte nicht gelöscht werden: ${error.message}`);
  } finally {
    state.isSavingConfirmation = false;
    render();
  }
}

function drawHolidayConfirmationPage(pdf, { request, profile }) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const approvalDate = new Date().toLocaleDateString('de-CH');
  const typeLabel = getAbsenceTypeLabel(request, request.request_type);
  const detailRows = [
    ['Mitarbeiter', profile?.full_name || 'Unbekannt'],
    ['Typ', typeLabel],
    ['Von', formatDate(request.start_date)],
    ['Bis', formatDate(request.end_date)],
    ['Dauer', getHolidayRequestDurationLabel(request)],
    ['Bestätigung PL', String(request.controll_pl || '').trim() || '–'],
    ['Bestätigung GL', String(request.controll_gl || '').trim() || '–'],
    ['Erstellt am', approvalDate],
  ];

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.text('Bestätigung Absenz', margin, 22);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10.5);
  const introText = `Hiermit wird bestätigt, dass die Absenz "${typeLabel}" für ${profile?.full_name || 'den Mitarbeiter'} im Zeitraum vom ${formatDate(request.start_date)} bis ${formatDate(request.end_date)} durch PL und GL freigegeben wurde.`;
  pdf.text(introText, margin, 32, { maxWidth: contentWidth, lineHeightFactor: 1.4 });

  pdf.autoTable({
    startY: 46,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    head: [['Feld', 'Wert']],
    body: detailRows,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [215, 0, 21], textColor: [255, 255, 255] },
    columnStyles: { 0: { cellWidth: 42, fontStyle: 'bold' }, 1: { cellWidth: contentWidth - 42 } },
  });

  const notesY = (pdf.lastAutoTable?.finalY || 92) + 10;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('Bemerkung', margin, notesY);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.rect(margin, notesY + 3, contentWidth, 38);
  pdf.text(request.notes || 'Keine zusätzliche Bemerkung vorhanden.', margin + 3, notesY + 10, {
    maxWidth: contentWidth - 6,
    lineHeightFactor: 1.4,
  });

  const signatureTop = notesY + 52;
  const signatureLineWidth = Math.min(92, contentWidth);
  const signatureLeft = margin + (contentWidth - signatureLineWidth) / 2;
  pdf.line(signatureLeft, signatureTop, signatureLeft + signatureLineWidth, signatureTop);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Unterschrift', signatureLeft, signatureTop + 6);
}

async function deleteHolidayRequestAttachments(attachments = []) {
  if (!Array.isArray(attachments) || !attachments.length || state.isDemoMode || !state.supabase) {
    return;
  }

  const paths = attachments
    .map((attachment) => String(attachment?.path || '').trim())
    .filter(Boolean);

  if (!paths.length) {
    return;
  }

  const { error } = await state.supabase.storage.from(STORAGE_BUCKET).remove(paths);
  if (error) {
    throw error;
  }
}

async function deleteHolidayRequestAttachmentsSafely(attachments = []) {
  try {
    await deleteHolidayRequestAttachments(attachments);
  } catch (error) {
    console.warn('Absenz-Anhänge konnten nach der Archivierung nicht gelöscht werden.', error);
  }
}

async function deleteWeeklyReportAttachments(attachments = []) {
  if (!Array.isArray(attachments) || !attachments.length || state.isDemoMode || !state.supabase) {
    return;
  }

  const paths = attachments
    .map((attachment) => String(attachment?.path || '').trim())
    .filter(Boolean);

  if (!paths.length) {
    return;
  }

  const { error } = await state.supabase.storage.from(STORAGE_BUCKET).remove(paths);
  if (error) {
    throw error;
  }
}

async function deleteWeeklyReportAttachmentsSafely(attachments = []) {
  try {
    await deleteWeeklyReportAttachments(attachments);
  } catch (error) {
    console.warn('Rapport-Anhänge konnten nach dem Löschen nicht entfernt werden.', error);
  }
}

function drawHolidayAttachmentListPage(pdf, { attachments, request, profile }) {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text('Anhangsverzeichnis', 15, 18);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(`${profile?.full_name || 'Unbekannt'} · ${getAbsenceTypeLabel(request, request.request_type)}`, 15, 25);

  const body = attachments.map((attachment) => [
    attachment.name || 'Anhang',
    attachment.mimeType || 'Datei',
    getAttachmentUrl(attachment) || 'Kein Link verfügbar',
  ]);

  pdf.autoTable({
    startY: 32,
    margin: { left: 15, right: 15 },
    head: [['Datei', 'Typ', 'Quelle']],
    body,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.2, overflow: 'linebreak' },
    headStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 48 },
      1: { cellWidth: 34 },
      2: { cellWidth: 98 },
    },
  });
}

function buildHolidayConfirmationFileName(request, profile) {
  const safeName = String(profile?.full_name || 'mitarbeiter')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `bestaetigung-${safeName || 'mitarbeiter'}-${request.start_date}-${request.end_date}.pdf`;
}

function buildWeeklyReportLayout(reports) {
  const regularRows = buildWeeklyMatrixRows(
    reports.filter((report) => !isAbsenceReport(report)),
  );
  const absenceRows = buildAbsenceMatrixRows(reports);
  const notes = buildWeeklyRemarkLines(reports);
  const totals = regularRows.reduce(
    (summary, row) => {
      row.dailyMinutes.forEach((minutes, index) => {
        summary.dailyMinutes[index] += minutes;
      });
      summary.totalMinutes += row.totalMinutes;
      summary.expenses += row.expenses;
      return summary;
    },
    {
      dailyMinutes: Array(6).fill(0),
      totalMinutes: 0,
      expenses: 0,
    },
  );

  return {
    regularRows,
    absenceRows,
    notes,
    totals,
  };
}

function drawWeeklyReportPage(pdf, { profile, weekRange, calendarWeek, layout }) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const marginLeft = 14;
  const marginRight = 8;
  const contentWidth = pageWidth - marginLeft - marginRight;
  const nameBoxY = 24;
  const nameBoxHeight = 10;
  const mainTableY = 40;

  drawReportHeader(pdf, {
    profile,
    weekRange,
    calendarWeek,
    marginLeft,
    contentWidth,
    nameBoxY,
    nameBoxHeight,
  });

  const regularBody = layout.regularRows.length
    ? layout.regularRows.map((row) => [
        row.projectName,
        row.commission,
        ...row.days,
        formatHours(row.totalMinutes),
        formatCurrency(row.expenses),
        row.notes.join(' | '),
      ])
    : [];
  while (regularBody.length < 10) {
    regularBody.push(['', '', '', '', '', '', '', '', '', '', '']);
  }

  pdf.autoTable({
    startY: mainTableY,
    margin: { left: marginLeft, right: marginRight },
    tableWidth: contentWidth,
    head: [['Projektname', 'Kom. Nr.', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'Total', 'Spesen', 'Bemerkungen']],
    body: regularBody,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.2,
      cellPadding: 1,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      minCellHeight: 5.3,
      overflow: 'linebreak',
      valign: 'middle',
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 26 },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 12, halign: 'center' },
      5: { cellWidth: 12, halign: 'center' },
      6: { cellWidth: 12, halign: 'center' },
      7: { cellWidth: 12, halign: 'center' },
      8: { cellWidth: 14, halign: 'center' },
      9: { cellWidth: 16, halign: 'center' },
      10: { cellWidth: 77 },
    },
  });

  const totalsY = (pdf.lastAutoTable?.finalY || mainTableY) + 3;
  const absencesY = totalsY + 10;
  const remarksY = absencesY + layout.absenceRows.length * 6 + 4;

  drawWeeklyTotalRow(pdf, { margin: marginLeft, totalsY, contentWidth, totals: layout.totals });
  drawAbsenceTable(pdf, { margin: marginLeft, y: absencesY, width: contentWidth, rows: layout.absenceRows });
  drawRemarksBox(pdf, { margin: marginLeft, y: remarksY, width: contentWidth, height: 16, notes: layout.notes });
}

function drawReportHeader(pdf, { profile, weekRange, calendarWeek, marginLeft, contentWidth, nameBoxY, nameBoxHeight }) {
  pdf.setDrawColor(0, 0, 0);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(24);
  pdf.setTextColor(215, 0, 21);
  pdf.text('MARÉCHAUX', marginLeft, 14);
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);
  pdf.text('elektrisch gut.', marginLeft + 20, 18);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.setTextColor(0, 0, 0);
  pdf.text('Wochenrapport', marginLeft + contentWidth / 2, 14, { align: 'center' });

  pdf.rect(marginLeft, nameBoxY, contentWidth, nameBoxHeight);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'italic');
  pdf.text(profile.full_name || '–', marginLeft + 1, nameBoxY + 7);

  pdf.setFont('helvetica', 'normal');
  pdf.text(`${formatDate(weekRange.start)} - ${formatDate(weekRange.end)}`, marginLeft + contentWidth / 2, nameBoxY + 6.8, { align: 'center' });
  pdf.setFont('helvetica', 'bold');
  pdf.text(String(calendarWeek), marginLeft + contentWidth - 2, nameBoxY + 6.8, { align: 'right' });
}

function drawWeeklyTotalRow(pdf, { margin, totalsY, contentWidth, totals }) {
  const projectWidth = 70;
  const commissionWidth = 26;
  const dayWidth = 12;
  const totalWidth = 14;
  const expensesWidth = 16;
  const notesWidth = contentWidth - projectWidth - commissionWidth - dayWidth * 6 - totalWidth - expensesWidth;
  let x = margin;

  pdf.setLineWidth(0.2);
  pdf.rect(margin, totalsY, contentWidth, 8);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.text('Wochentotal', x + 1, totalsY + 5.3);
  x += projectWidth;
  pdf.line(x, totalsY, x, totalsY + 8);
  x += commissionWidth;
  pdf.line(x, totalsY, x, totalsY + 8);

  totals.dailyMinutes.forEach((minutes) => {
    pdf.line(x, totalsY, x, totalsY + 8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(formatHours(minutes), x + dayWidth / 2, totalsY + 5.3, { align: 'center' });
    x += dayWidth;
  });

  pdf.line(x, totalsY, x, totalsY + 8);
  pdf.text(formatHours(totals.totalMinutes), x + totalWidth / 2, totalsY + 5.3, { align: 'center' });
  x += totalWidth;

  pdf.line(x, totalsY, x, totalsY + 8);
  pdf.text(formatCurrency(totals.expenses), x + expensesWidth / 2, totalsY + 5.3, { align: 'center' });
  x += expensesWidth;

  pdf.line(x, totalsY, x, totalsY + 8);
  x += notesWidth;
  pdf.line(x, totalsY, x, totalsY + 8);
}

function drawAbsenceTable(pdf, { margin, y, width, rows }) {
  const labelWidth = 96;
  const dayWidth = 12;
  const totalWidth = 14;
  const notesWidth = width - labelWidth - dayWidth * 6 - totalWidth;
  const rowHeight = 6;
  const absenceRows = rows.length ? rows : buildEmptyAbsenceRows();
  const height = rowHeight * absenceRows.length;

  pdf.rect(margin, y, width, height);
  let currentY = y;
  absenceRows.forEach((row, index) => {
    if (index > 0) {
      pdf.line(margin, currentY, margin + width, currentY);
    }
    pdf.line(margin + labelWidth, currentY, margin + labelWidth, currentY + rowHeight);

    let x = margin + labelWidth;
    row.days.forEach(() => {
      pdf.line(x + dayWidth, currentY, x + dayWidth, currentY + rowHeight);
      x += dayWidth;
    });
    pdf.line(x + totalWidth, currentY, x + totalWidth, currentY + rowHeight);

    pdf.setFont('helvetica', index === absenceRows.length - 1 ? 'bold' : 'normal');
    pdf.setFontSize(8.5);
    pdf.text(row.label, margin + 1, currentY + 4.2);
    row.days.forEach((value, dayIndex) => {
      pdf.text(value, margin + labelWidth + dayWidth * dayIndex + dayWidth / 2, currentY + 4.2, { align: 'center' });
    });
    pdf.text(row.total, margin + labelWidth + dayWidth * 6 + totalWidth / 2, currentY + 4.2, { align: 'center' });
    if (row.notes) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.2);
      pdf.text(row.notes, margin + width - notesWidth + 1, currentY + 4.2, { maxWidth: notesWidth - 2 });
    }
    currentY += rowHeight;
  });
}

function drawRemarksBox(pdf, { margin, y, width, height, notes }) {
  pdf.rect(margin, y, width, height);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('Bemerkung', margin + 1, y + 5);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  const content = notes.length ? notes.join(' | ') : '–';
  pdf.text(content, margin + 24, y + 5, { maxWidth: width - 26 });
}

async function drawAttachmentGalleryPage(pdf, attachments, { profileName, calendarWeek }) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const slotGap = 8;
  const titleY = 18;
  const contentTopY = 24;
  const slotCount = 2;
  const slotWidth = (pageWidth - margin * 2 - slotGap) / slotCount;
  const slotHeight = pageHeight - contentTopY - margin;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(`Anhänge · ${profileName} · ${calendarWeek}`, margin, titleY);

  for (const [index, attachment] of attachments.entries()) {
    const slotX = margin + index * (slotWidth + slotGap);
    const slotY = contentTopY;
    try {
      const dataUrl = await fileToDataUrl(getAttachmentUrl(attachment));
      const imageProps = pdf.getImageProperties(dataUrl);
      const scale = Math.min(slotWidth / imageProps.width, slotHeight / imageProps.height);
      const renderWidth = imageProps.width * scale;
      const renderHeight = imageProps.height * scale;
      const renderX = slotX + (slotWidth - renderWidth) / 2;
      const renderY = slotY + (slotHeight - renderHeight) / 2;
      pdf.addImage(dataUrl, imageProps.fileType || 'JPEG', renderX, renderY, renderWidth, renderHeight);
    } catch (error) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text('Bild konnte nicht geladen werden.', slotX, slotY + 10);
    }
  }
}

function buildWeeklyMatrixRows(reports) {
  const groups = new Map();

  reports.forEach((report) => {
    const projectName = String(report.project_name || '').trim();
    const commission = String(report.commission_number || '').trim();
    const key = `${projectName}__${commission}`;
    if (!groups.has(key)) {
      groups.set(key, {
        projectName: projectName || 'Ohne Projektname',
        commission: commission || '–',
        days: Array(6).fill(''),
        dailyMinutes: Array(6).fill(0),
        totalMinutes: 0,
        expenses: 0,
        notes: [],
      });
    }

    const dayIndex = getWeekdayIndex(report.work_date);
    if (dayIndex < 0 || dayIndex > 5) {
      return;
    }

    const current = groups.get(key);
    const workedHours = report.total_work_minutes > 0 ? formatHours(report.total_work_minutes) : '–';
    current.days[dayIndex] = current.days[dayIndex]
      ? `${current.days[dayIndex]} / ${workedHours}`
      : workedHours;
    current.dailyMinutes[dayIndex] += Number(report.total_work_minutes || 0);
    current.totalMinutes += Number(report.total_work_minutes || 0);
    current.expenses += Number(report.expenses_amount || 0) + Number(report.other_costs_amount || 0);
    if (report.notes) current.notes.push(report.notes);
  });

  return [...groups.values()];
}

function buildAbsenceMatrixRows(reports) {
  const rows = ABSENCE_CATEGORY_CONFIG.map((category) => ({
    typeCode: category.typeCode,
    label: category.label,
    days: Array(6).fill(0),
    totalMinutes: 0,
    notes: [],
  }));

  reports.forEach((report) => {
    const absenceTypeCode = getAbsenceTypeCode(report);
    if (!absenceTypeCode) {
      return;
    }

    const row = rows.find((item) => item.typeCode === absenceTypeCode);
    const dayIndex = getWeekdayIndex(report.work_date);
    if (!row || dayIndex < 0 || dayIndex > 5) {
      return;
    }

    const absenceMinutes = getAbsenceMinutes(report);
    row.days[dayIndex] += absenceMinutes;
    row.totalMinutes += absenceMinutes;
    const projectName = String(report.project_name || '').trim();
    const commissionNumber = String(report.commission_number || '').trim();
    if (projectName) row.notes.push(projectName);
    if (!projectName && commissionNumber) row.notes.push(commissionNumber);
    if (report.notes) row.notes.push(report.notes);
  });

  const normalizedRows = rows.map((row) => ({
    label: row.label,
    days: row.days.map((minutes) => (minutes ? formatHours(minutes) : '')),
    total: row.totalMinutes ? formatHours(row.totalMinutes) : '',
    notes: dedupeStrings(row.notes).join(' | '),
  }));

  const totalAbsenceMinutes = rows.reduce((sum, row) => sum + row.totalMinutes, 0);
  normalizedRows.push({
    label: 'Total Absenzen',
    days: Array(6).fill(''),
    total: totalAbsenceMinutes ? formatHours(totalAbsenceMinutes) : '',
    notes: '',
  });

  return normalizedRows;
}

function getAbsenceMinutes(report) {
  const recordedMinutes = getAdjustedWorkMinutes(report);
  if (recordedMinutes > 0) {
    return recordedMinutes;
  }

  return 8 * 60;
}

function isHolidayRequestFullyApproved(request) {
  return Boolean(String(request?.controll_pl || '').trim() && String(request?.controll_gl || '').trim());
}

async function createAutoReportsForApprovedHolidayRequest(request) {
  if (!request?.profile_id || !request?.start_date || !request?.end_date) {
    return;
  }

  const requestTypeLabel = getAbsenceTypeLabel(request, String(request.request_type || 'Absenz'));
  const requestTypeCode = getAbsenceTypeCode(request);
  const days = [];
  const cursor = new Date(`${request.start_date}T00:00:00Z`);
  const endDate = new Date(`${request.end_date}T00:00:00Z`);
  while (cursor <= endDate) {
    const weekday = cursor.getUTCDay();
    if (weekday >= 1 && weekday <= 5) {
      days.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (!days.length) {
    return;
  }

  if (state.isDemoMode) {
    const holidayDates = new Set(
      demoWeeklyReports
        .filter((report) => String(report.profile_id) === String(request.profile_id) && Number(report.abz_typ) === 5)
        .map((report) => String(report.work_date)),
    );
    state.platformHolidays.forEach((entry) => holidayDates.add(String(entry.holiday_date || '')));
    const daysWithoutHoliday = days.filter((workDate) => !holidayDates.has(String(workDate)));
    if (!daysWithoutHoliday.length) {
      return;
    }
    const existingDates = new Set(
      demoWeeklyReports
        .filter((report) => String(report.profile_id) === String(request.profile_id))
        .map((report) => report.work_date),
    );
    daysWithoutHoliday.forEach((workDate) => {
      if (existingDates.has(workDate)) {
        return;
      }
      demoWeeklyReports.push(buildAutoAbsenceWeeklyReport(request, workDate, requestTypeLabel, requestTypeCode));
    });
    return;
  }

  const { data: existingReports, error: existingReportsError } = await state.supabase
    .from('weekly_reports')
    .select('work_date, abz_typ')
    .eq('profile_id', request.profile_id)
    .in('work_date', days);
  if (existingReportsError) {
    throw existingReportsError;
  }
  const holidayDates = new Set(state.platformHolidays.map((entry) => String(entry.holiday_date || '')));
  (existingReports || []).forEach((report) => {
    if (Number(report.abz_typ) === 5 && report.work_date) {
      holidayDates.add(String(report.work_date));
    }
  });
  const daysWithoutHoliday = days.filter((workDate) => !holidayDates.has(String(workDate)));
  if (!daysWithoutHoliday.length) {
    return;
  }
  const existingDates = new Set((existingReports ?? []).map((report) => report.work_date));
  const rowsToInsert = daysWithoutHoliday
    .filter((workDate) => !existingDates.has(workDate))
    .map((workDate) => buildAutoAbsenceWeeklyReport(request, workDate, requestTypeLabel, requestTypeCode));
  if (!rowsToInsert.length) {
    return;
  }
  const { error } = await state.supabase.from('weekly_reports').insert(rowsToInsert);
  if (error) {
    throw error;
  }
}

function buildAutoAbsenceWeeklyReport(request, workDate, requestTypeLabel, requestTypeCode) {
  const adjustedMinutesField = getAdjustedMinutesFieldName();
  const isoWeek = getIsoYearAndWeekFromDateString(workDate);
  return {
    id: crypto.randomUUID(),
    profile_id: request.profile_id,
    work_date: workDate,
    year: isoWeek.year,
    kw: isoWeek.kw,
    project_name: requestTypeLabel,
    commission_number: requestTypeLabel,
    abz_typ: Number.isInteger(requestTypeCode) ? requestTypeCode : 0,
    start_time: '07:00',
    end_time: '16:30',
    lunch_break_minutes: 60,
    additional_break_minutes: 30,
    total_work_minutes: 480,
    [adjustedMinutesField]: 480,
    expenses_amount: 0,
    other_costs_amount: 0,
    expense_note: '',
    notes: `Automatisch erstellt aus bestätigter Absenz (${requestTypeLabel}).`,
    controll: '',
    attachments: [],
  };
}

function getHolidayRequestDurationLabel(request) {
  const start = new Date(`${request.start_date}T00:00:00Z`);
  const end = new Date(`${request.end_date}T00:00:00Z`);
  const diffDays = Math.round((end - start) / 86400000) + 1;
  if (diffDays <= 1) {
    return '1 Tag';
  }
  return `${diffDays} Tage`;
}

function buildWeeklyRemarkLines(reports) {
  const notes = [];
  reports.forEach((report) => {
    if (report.notes) {
      notes.push(`${formatDate(report.work_date)}: ${report.notes}`);
    }

    const nightWorkRemark = buildNightWorkRemark(report);
    if (nightWorkRemark) {
      notes.push(nightWorkRemark);
    }
  });
  return dedupeStrings(notes);
}

function buildNightWorkRemark(report) {
  const overlap = getNightShiftOverlap(report.start_time, report.end_time);
  if (!overlap) {
    return '';
  }

  return `Nachtarbeit ${getWeekdayLabel(report.work_date)}: ${formatTimeLabel(overlap.start)}–${formatTimeLabel(overlap.end)}`;
}

function getNightShiftOverlap(startTime, endTime) {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (startMinutes === null || endMinutes === null) {
    return null;
  }

  const normalizedEndMinutes = endMinutes <= startMinutes ? endMinutes + 24 * 60 : endMinutes;
  const nightWindows = [
    { start: 0, end: 6 * 60 },
    { start: 22 * 60, end: 30 * 60 },
  ];

  const overlapSegments = nightWindows
    .map((window) => ({
      start: Math.max(startMinutes, window.start),
      end: Math.min(normalizedEndMinutes, window.end),
    }))
    .filter((segment) => segment.end > segment.start);

  if (!overlapSegments.length) {
    return null;
  }

  return {
    start: overlapSegments[0].start,
    end: overlapSegments[overlapSegments.length - 1].end,
  };
}

function buildEmptyAbsenceRows() {
  return [
    { label: 'Ferien', days: Array(6).fill(''), total: '', notes: '' },
    { label: 'Krankheit', days: Array(6).fill(''), total: '', notes: '' },
    { label: 'Militär', days: Array(6).fill(''), total: '', notes: '' },
    { label: 'Unfall', days: Array(6).fill(''), total: '', notes: '' },
    { label: 'Feiertag', days: Array(6).fill(''), total: '', notes: '' },
    { label: 'ÜK', days: Array(6).fill(''), total: '', notes: '' },
    { label: 'Berufsschule', days: Array(6).fill(''), total: '', notes: '' },
    { label: 'Total Absenzen', days: Array(6).fill(''), total: '', notes: '' },
  ];
}

function isAbsenceReport(report) {
  return getAbsenceTypeCode(report) > 0;
}

function getAbsenceTypeCode(source) {
  const explicitFieldCandidates = ['abz_typ', 'abts_type', 'abts_underscore_type', 'absence_type'];
  for (const fieldName of explicitFieldCandidates) {
    const value = Number(source?.[fieldName]);
    if (Number.isInteger(value) && value >= 0) {
      return value;
    }
  }

  const normalizedRequestType = normalizeSearchValue(source?.request_type);
  if (normalizedRequestType && Object.prototype.hasOwnProperty.call(HOLIDAY_REQUEST_TYPE_TO_ABSENCE_TYPE_CODE, normalizedRequestType)) {
    return HOLIDAY_REQUEST_TYPE_TO_ABSENCE_TYPE_CODE[normalizedRequestType];
  }

  return 0;
}

function getAbsenceTypeLabel(source, fallbackLabel = '') {
  const typeCode = getAbsenceTypeCode(source);
  if (typeCode > 0 && ABSENCE_TYPE_CODE_LABELS[typeCode]) {
    return ABSENCE_TYPE_CODE_LABELS[typeCode];
  }

  const requestType = normalizeSearchValue(source?.request_type);
  if (requestType && HOLIDAY_TYPE_LABELS[requestType]) {
    return HOLIDAY_TYPE_LABELS[requestType];
  }

  return String(fallbackLabel || source?.request_type || 'Absenz').trim() || 'Absenz';
}

function normalizeSearchValue(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function dedupeStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseTimeToMinutes(timeString) {
  const match = String(timeString || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function formatTimeLabel(totalMinutes) {
  const normalizedMinutes = ((Number(totalMinutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getWeekdayLabel(dateString) {
  return WEEKDAY_LABELS[getWeekdayIndex(dateString)] || '';
}

function formatHours(totalMinutes) {
  const numericMinutes = Number(totalMinutes || 0);
  if (!numericMinutes) {
    return '';
  }
  return (numericMinutes / 60).toFixed(2);
}

function getIncompleteSubmissionProfiles({ selectedOnly = false } = {}) {
  const groups = groupReportsByProfile(state.weeklyReports);
  const selectedIds = new Set(state.selectedEmployeeIds);
  return getReportableProfiles().flatMap((profile) => {
    if (selectedOnly && !selectedIds.has(profile.id)) {
      return [];
    }

    const reports = groups.get(profile.id) ?? [];
    const totalMinutes = reports.reduce((sum, report) => sum + getAdjustedWorkMinutes(report), 0);
    const weeklyHours = Number(profile.weekly_hours || 40);
    const minimumMinutes = weeklyHours * 60 * 0.8;

    if (!reports.length) {
      return [{
        profile,
        totalMinutes: 0,
        status: 'missing',
        statusLabel: 'Fehlt',
        description: 'Für diese Woche wurde noch kein Rapport eingereicht.',
      }];
    }

    if (totalMinutes < minimumMinutes) {
      return [{
        profile,
        totalMinutes,
        status: 'incomplete',
        statusLabel: 'Unvollständig',
        description: `Rapportierte Zeit liegt unter 80% der Sollzeit (${(minimumMinutes / 60).toFixed(2)} h).`,
      }];
    }

    return [];
  });
}

function getAvailableReportProfileIds() {
  const profileIds = getReportableProfiles().map((profile) => profile.id);
  if (profileIds.length) {
    return profileIds;
  }

  return [...new Set(state.weeklyReports.map((report) => report.profile_id).filter(Boolean))];
}

function getAvailableAbsenceProfileIds() {
  const profileIds = getAbsenceFilterProfiles().map((profile) => profile.id);
  if (profileIds.length) {
    return profileIds;
  }

  return [...new Set(state.holidayRequests.map((request) => request.profile_id).filter(Boolean))];
}

function getReportableProfiles() {
  return getActiveProfiles();
}

function getAbsenceFilterProfiles() {
  return getReportableProfiles();
}

function getActiveProfiles() {
  return state.profiles.filter((profile) => profile.is_active !== false);
}

function getMatchingProfiles(profiles, query) {
  const normalizedQuery = `${query || ''}`.trim().toLowerCase();
  return profiles.filter((profile) => `${profile.full_name}`.toLowerCase().includes(normalizedQuery));
}

function getFilteredHolidayRequests() {
  return [...state.holidayRequests]
    .filter((request) => !isHolidayRequestFullyApproved(request))
    .sort((a, b) => `${b.start_date}`.localeCompare(`${a.start_date}`));
}

function groupReportsByProfile(reports) {
  const groups = new Map();
  reports.forEach((report) => {
    if (!groups.has(report.profile_id)) {
      groups.set(report.profile_id, []);
    }
    groups.get(report.profile_id).push(report);
  });
  return groups;
}

function getProfileById(profileId) {
  return state.profiles.find((profile) => profile.id === profileId);
}

function renderAttachmentLinks(attachments = []) {
  if (!Array.isArray(attachments) || !attachments.length) {
    return '–';
  }

  return `<div class="attachment-list">${attachments
    .map((attachment) => {
      const url = getAttachmentUrl(attachment);
      const name = escapeHtml(attachment.name || 'Anhang');
      if (!url || url === '#') {
        return `<span class="subtle-text">${name} (kein Download-Link)</span>`;
      }

      const escapedUrl = escapeAttribute(url);
      const openLink = `<a href="${escapedUrl}" target="_blank" rel="noreferrer">${name}</a>`;
      if (!isPdfAttachment(attachment)) {
        return openLink;
      }
      const downloadUrl = buildForcedDownloadUrl(url, attachment.name || 'anhang.pdf');
      return `${openLink} <a href="${escapeAttribute(downloadUrl)}" rel="noreferrer">(PDF herunterladen)</a>`;
    })
    .join('')}</div>`;
}

function setConnectionBadge(text, warning = false) {
  elements.connectionBadge.textContent = text;
  elements.connectionBadge.classList.toggle('badge-soft', !warning);
  elements.connectionBadge.classList.toggle('badge-warning', warning);
}

function showLoginMessage(message, isError = true) {
  elements.loginAlert.classList.remove('hidden');
  elements.loginAlert.textContent = message;
  elements.loginAlert.style.background = isError ? 'rgba(248, 113, 113, 0.12)' : 'rgba(34, 197, 94, 0.12)';
  elements.loginAlert.style.borderColor = isError ? 'rgba(248, 113, 113, 0.28)' : 'rgba(34, 197, 94, 0.28)';
  elements.loginAlert.style.color = isError ? '#fee2e2' : '#dcfce7';
}

function getCurrentWeekValue() {
  const now = new Date();
  const target = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getWeekRange(weekValue) {
  const [yearPart, weekPart] = weekValue.split('-W');
  const year = Number(yearPart);
  const week = Number(weekPart);
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dayOfWeek = simple.getUTCDay();
  const monday = new Date(simple);
  if (dayOfWeek <= 4) {
    monday.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  } else {
    monday.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  }
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

function getYearAndWeekFromWeekValue(weekValue) {
  const [yearPart, weekPart] = String(weekValue || '').split('-W');
  return {
    year: Number(yearPart),
    kw: Number(weekPart),
  };
}

function getIsoYearAndWeekFromDateString(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return { year: null, kw: null };
  }
  const isoWeekValue = getIsoWeekValueFromDate(date);
  return getYearAndWeekFromWeekValue(isoWeekValue);
}

function getWeekLabel(weekValue) {
  const [, weekPart] = weekValue.split('-W');
  return `KW ${weekPart}`;
}

function shiftWeekValue(weekValue, weekDelta) {
  const weekRange = getWeekRange(weekValue);
  const monday = new Date(`${weekRange.start}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() + weekDelta * 7);
  return getIsoWeekValueFromDate(monday);
}

function getIsoWeekValueFromDate(date) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getWeekdayIndex(dateString) {
  const day = new Date(`${dateString}T00:00:00Z`).getUTCDay();
  return day === 0 ? 6 : day - 1;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(Number(value || 0));
}

function formatMinutes(minutes) {
  return `${(Number(minutes || 0) / 60).toFixed(2)} h`;
}

function formatDate(dateString) {
  return new Date(`${dateString}T00:00:00Z`).toLocaleDateString('de-CH');
}

function formatTimeWithoutSeconds(timeValue) {
  const raw = String(timeValue || '').trim();
  if (!raw) return '–';
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function formatTimeRange(startTime, endTime) {
  const startLabel = formatTimeWithoutSeconds(startTime);
  const endLabel = formatTimeWithoutSeconds(endTime);
  if (startLabel === '–' && endLabel === '–') return '–';
  return `${startLabel} – ${endLabel}`;
}

function normalizeTimeForInput(value) {
  const normalized = formatTimeWithoutSeconds(value);
  return normalized === '–' ? '' : normalized;
}

function renderSaldoInput(profileId, fieldName, value, step = 0.5) {
  return `<input class="saldo-input" type="number" step="${escapeAttribute(step)}" data-saldo-input="${escapeAttribute(fieldName)}" data-profile-id="${escapeAttribute(profileId)}" value="${escapeAttribute(Number(value || 0).toFixed(2))}" />`;
}

function getSaldoInputValue(profileId, fieldName) {
  const input = document.querySelector(`[data-saldo-input="${fieldName}"][data-profile-id="${profileId}"]`);
  if (!input) {
    return 0;
  }
  return Number(input.value || 0);
}

function getProfileSaldoMetrics(profile, currentIsoWeek = getCurrentIsoWeekNumber()) {
  const vacationAllowanceHours = Number(profile.vacation_allowance_hours || 0);
  const bookedVacationHours = Number(profile.booked_vacation_hours || 0);
  const carryoverOvertimeHours = Number(profile.carryover_overtime_hours || 0);
  const reportedHours = Number(profile.reported_hours || 0);
  const creditedHours = Number(profile.credited_hours || 0);
  const weeklyHours = Number(profile.weekly_hours || 40);
  const expectedHours = currentIsoWeek * weeklyHours;
  const overtimeBalanceHours = carryoverOvertimeHours + creditedHours + (reportedHours - expectedHours);
  const vacationBalanceHours = vacationAllowanceHours - bookedVacationHours;

  return {
    vacationAllowanceHours,
    bookedVacationHours,
    carryoverOvertimeHours,
    reportedHours,
    creditedHours,
    weeklyHours,
    overtimeBalanceHours,
    vacationBalanceHours,
  };
}

function getCurrentIsoWeekNumber() {
  const weekValue = getCurrentWeekValue();
  const [, weekPart] = weekValue.split('-W');
  return Number(weekPart || 1);
}

function buildAdjustedMinutesUpdatePayload(report, adjustedMinutes) {
  if (Object.prototype.hasOwnProperty.call(report || {}, 'total_adjusted_work_minutes')) {
    return { total_adjusted_work_minutes: adjustedMinutes };
  }
  return { adjusted_work_minutes: adjustedMinutes };
}

function getAdjustedMinutesFieldName() {
  const hasTotalAdjustedMinutes = state.weeklyReports.some((report) =>
    Object.prototype.hasOwnProperty.call(report || {}, 'total_adjusted_work_minutes'));
  if (hasTotalAdjustedMinutes) {
    return 'total_adjusted_work_minutes';
  }
  return 'adjusted_work_minutes';
}

function getAdjustedWorkMinutes(report) {
  const baseAdjustedMinutes = getBaseAdjustedWorkMinutes(report);
  if (shouldApplyHolidayDoubleMinutes(report)) {
    return baseAdjustedMinutes * 2;
  }
  return baseAdjustedMinutes;
}

function getBaseAdjustedWorkMinutes(report) {
  const totalAdjustedMinutes = Number(report?.total_adjusted_work_minutes);
  const adjustedMinutes = Number(report?.adjusted_work_minutes);

  if (Number.isFinite(totalAdjustedMinutes) && totalAdjustedMinutes >= 0) {
    if (totalAdjustedMinutes === 0 && Number.isFinite(adjustedMinutes) && adjustedMinutes > 0) {
      return adjustedMinutes;
    }
    return totalAdjustedMinutes;
  }

  if (Number.isFinite(adjustedMinutes) && adjustedMinutes >= 0) {
    return adjustedMinutes;
  }
  return Number(report?.total_work_minutes || 0);
}

function shouldApplyHolidayDoubleMinutes(report) {
  if (!report || isHolidayMinutesReport(report)) {
    return false;
  }
  return state.weeklyReports.some((entry) =>
    String(entry?.id) !== String(report.id)
    && String(entry?.profile_id) === String(report.profile_id)
    && String(entry?.work_date) === String(report.work_date)
    && isHolidayMinutesReport(entry));
}

function isHolidayMinutesReport(report) {
  const haystack = [report?.project_name, report?.commission_number, report?.notes, report?.expense_note]
    .map((value) => normalizeSearchValue(value || ''))
    .join(' ');
  return haystack.includes('feiertag');
}

function getReportBookingDelta(report, multiplier = 1) {
  const hours = getAdjustedWorkMinutes(report) / 60;
  const isVacation = isVacationReport(report);
  return {
    reportedHoursDelta: hours * multiplier,
    bookedVacationHoursDelta: isVacation ? hours * multiplier : 0,
  };
}

function isVacationReport(report) {
  const text = [report?.commission_number, report?.notes, report?.expense_note]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');
  return text.includes('ferien') || text.includes('fehlen');
}

function applyDemoReportBookingDelta(report, multiplier = 1) {
  if (!report) {
    return;
  }
  const profile = demoProfiles.find((item) => String(item.id) === String(report.profile_id));
  if (!profile) {
    return;
  }

  const delta = getReportBookingDelta(report, multiplier);
  profile.reported_hours = Number(profile.reported_hours || 0) + delta.reportedHoursDelta;
  profile.booked_vacation_hours = Number(profile.booked_vacation_hours || 0) + delta.bookedVacationHoursDelta;
}

function applyDemoBookingDeltaDifference(profileId, previousDelta, nextDelta) {
  const profile = demoProfiles.find((item) => String(item.id) === String(profileId));
  if (!profile) {
    return;
  }
  profile.reported_hours = Number(profile.reported_hours || 0) + Number(nextDelta?.reportedHoursDelta || 0) - Number(previousDelta?.reportedHoursDelta || 0);
  profile.booked_vacation_hours = Number(profile.booked_vacation_hours || 0) + Number(nextDelta?.bookedVacationHoursDelta || 0) - Number(previousDelta?.bookedVacationHoursDelta || 0);
}

async function applyProfileBookingDelta(profileId, delta) {
  if (!profileId || state.isDemoMode || !state.supabase || !delta) {
    return;
  }

  const profile = state.profiles.find((item) => String(item.id) === String(profileId));
  if (!profile) {
    return;
  }

  const updates = {
    reported_hours: Number(profile.reported_hours || 0) + Number(delta.reportedHoursDelta || 0),
    booked_vacation_hours: Number(profile.booked_vacation_hours || 0) + Number(delta.bookedVacationHoursDelta || 0),
  };

  const { error } = await state.supabase.from('app_profiles').update(updates).eq('id', profileId);
  if (error) {
    throw error;
  }
}

async function applyProfileBookingDeltaDifference(profileId, previousDelta, nextDelta) {
  const difference = {
    reportedHoursDelta: Number(nextDelta?.reportedHoursDelta || 0) - Number(previousDelta?.reportedHoursDelta || 0),
    bookedVacationHoursDelta: Number(nextDelta?.bookedVacationHoursDelta || 0) - Number(previousDelta?.bookedVacationHoursDelta || 0),
  };
  await applyProfileBookingDelta(profileId, difference);
}

function buildFallbackProfileFromUser(user) {
  if (!user) {
    return null;
  }

  const email = String(user.email || '').trim().toLowerCase();
  return {
    id: user.id,
    email,
    full_name: email || 'Benutzer',
    role_label: 'Benutzer',
    is_admin: false,
    is_active: true,
  };
}

function getAccessConfigurationHint(error) {
  const message = String(error?.message || '').toLowerCase();
  if (!message) {
    return '';
  }

  if (message.includes('row-level security') || message.includes('permission denied') || message.includes('not allowed')) {
    return 'Bitte das aktualisierte SQL aus supabase-schema.sql im Supabase-Projekt ausführen, damit Profile mit is_admin = true Vollzugriff erhalten.';
  }

  if (message.includes("could not find the table 'public.project_assignments' in the schema cache")) {
    return 'Die Tabelle project_assignments wird in der aktuellen App-Version nicht mehr verwendet. Bitte das aktuelle SQL aus supabase-schema.sql ausführen und veraltete Abfragen auf project_assignments entfernen.';
  }

  return '';
}

function isAdminProfile(profile) {
  return profile?.is_admin === true || profile?.is_admin === 'true' || profile?.is_admin === 1;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function getDateForWeekOffset(weekOffset, dayOffset) {
  const currentRange = getWeekRange(getCurrentWeekValue());
  const monday = new Date(`${currentRange.start}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() + weekOffset * 7 + dayOffset);
  return monday.toISOString().slice(0, 10);
}

function getAttachmentUrl(attachment) {
  const publicUrl = String(attachment?.publicUrl || '').trim();
  if (publicUrl) return publicUrl;

  const path = String(attachment?.path || '').trim();
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;

  if (!state.supabase) {
    return path;
  }

  const bucket = String(attachment?.bucket || '').trim() || STORAGE_BUCKET;
  const { data } = state.supabase.storage.from(bucket).getPublicUrl(path);
  return String(data?.publicUrl || '').trim() || path;
}

function isImageAttachment(attachment) {
  return String(attachment.mimeType || '').startsWith('image/');
}

function isPdfAttachment(attachment) {
  const mimeType = String(attachment?.mimeType || '').toLowerCase();
  const name = String(attachment?.name || '').toLowerCase();
  return mimeType === 'application/pdf' || name.endsWith('.pdf');
}

function buildForcedDownloadUrl(url, fileName) {
  if (!url || url === '#') return '#';
  try {
    const downloadUrl = new URL(url, window.location.href);
    if (!downloadUrl.searchParams.has('download')) {
      downloadUrl.searchParams.set('download', fileName || 'anhang.pdf');
    }
    return downloadUrl.toString();
  } catch {
    return url;
  }
}

async function fileToDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Datei konnte nicht geladen werden');
  }
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
