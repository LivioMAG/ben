import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' };

type BookPersonRequest = {
  profile_id?: string;
  date_from?: string;
  date_to?: string;
  start_time?: string;
  end_time?: string;
  project_id?: string | null;
  label?: string;
  source?: string;
};

function parseIsoDate(input: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const date = new Date(`${input}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function listDatesInclusive(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function parseTimeToMinutes(rawInput: string): number | null {
  const input = rawInput.trim();
  const match = input.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

function isMissingTimeColumnsError(errorMessage: string | undefined): boolean {
  if (!errorMessage) return false;
  const normalized = errorMessage.toLowerCase();
  return normalized.includes('daily_assignments.start_time does not exist')
    || normalized.includes('daily_assignments.end_time does not exist')
    || (normalized.includes('column') && normalized.includes('start_time') && normalized.includes('does not exist'));
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Nur POST ist erlaubt.' }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt.' }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  let payload: BookPersonRequest;
  try {
    payload = (await req.json()) as BookPersonRequest;
  } catch (_error) {
    return new Response(JSON.stringify({ error: 'Ungültiger JSON-Body.' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const profileId = payload.profile_id?.trim();
  const dateFromRaw = payload.date_from?.trim();
  const dateToRaw = payload.date_to?.trim();
  const startTimeRaw = payload.start_time?.trim();
  const endTimeRaw = payload.end_time?.trim();
  const label = payload.label?.trim();
  const source = payload.source?.trim() || 'manual';

  if (!profileId) {
    return new Response(JSON.stringify({ error: 'profile_id ist erforderlich.' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  if (!dateFromRaw || !dateToRaw) {
    return new Response(JSON.stringify({ error: 'date_from und date_to sind erforderlich.' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  if (!startTimeRaw || !endTimeRaw) {
    return new Response(JSON.stringify({ error: 'start_time und end_time sind erforderlich.' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  if (!label) {
    return new Response(JSON.stringify({ error: 'label ist erforderlich.' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const dateFrom = parseIsoDate(dateFromRaw);
  const dateTo = parseIsoDate(dateToRaw);

  if (!dateFrom || !dateTo) {
    return new Response(JSON.stringify({ error: 'date_from und date_to müssen im Format YYYY-MM-DD sein.' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  if (dateTo < dateFrom) {
    return new Response(JSON.stringify({ error: 'date_to muss >= date_from sein.' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const startTimeMinutes = parseTimeToMinutes(startTimeRaw);
  const endTimeMinutes = parseTimeToMinutes(endTimeRaw);

  if (startTimeMinutes === null || endTimeMinutes === null) {
    return new Response(JSON.stringify({ error: 'start_time und end_time müssen im Format HH:MM sein.' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  if (endTimeMinutes <= startTimeMinutes) {
    return new Response(JSON.stringify({ error: 'end_time muss später als start_time sein.' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: conflicts, error: conflictsError } = await supabase
    .from('daily_assignments')
    .select('id, assignment_date, label, start_time, end_time')
    .eq('profile_id', profileId)
    .gte('assignment_date', dateFromRaw)
    .lte('assignment_date', dateToRaw)
    .order('assignment_date', { ascending: true });

  const usingLegacyDailyAssignmentsSchema = isMissingTimeColumnsError(conflictsError?.message);

  let timeConflicts: Array<{ assignment_date: string; label: string; start_time?: string; end_time?: string }> = [];

  if (usingLegacyDailyAssignmentsSchema) {
    const { data: legacyConflicts, error: legacyConflictsError } = await supabase
      .from('daily_assignments')
      .select('id, assignment_date, label')
      .eq('profile_id', profileId)
      .gte('assignment_date', dateFromRaw)
      .lte('assignment_date', dateToRaw)
      .order('assignment_date', { ascending: true });

    if (legacyConflictsError) {
      return new Response(JSON.stringify({ error: legacyConflictsError.message }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    timeConflicts = (legacyConflicts || []).map((entry) => ({
      assignment_date: entry.assignment_date,
      label: entry.label,
      start_time: '00:00',
      end_time: '23:59',
    }));
  } else if (conflictsError) {
    return new Response(JSON.stringify({ error: conflictsError.message }), {
      status: 400,
      headers: jsonHeaders,
    });
  } else {
    timeConflicts = (conflicts || []).filter((entry) => {
      const entryStart = parseTimeToMinutes(entry.start_time || '');
      const entryEnd = parseTimeToMinutes(entry.end_time || '');
      if (entryStart === null || entryEnd === null) return true;
      return startTimeMinutes < entryEnd && endTimeMinutes > entryStart;
    });
  }

  if (timeConflicts.length > 0) {
    return new Response(JSON.stringify({
      error: 'Diese Person ist im angegebenen Zeitraum zeitlich bereits im Dispo verbucht.',
      conflict_days: timeConflicts.map((entry) => ({
        assignment_date: entry.assignment_date,
        label: entry.label,
        start_time: entry.start_time,
        end_time: entry.end_time,
      })),
    }), {
      status: 409,
      headers: jsonHeaders,
    });
  }

  const datesToBook = listDatesInclusive(dateFrom, dateTo);
  const rows = datesToBook.map((assignmentDate) => ({
    profile_id: profileId,
    assignment_date: assignmentDate,
    ...(usingLegacyDailyAssignmentsSchema ? {} : {
      start_time: startTimeRaw,
      end_time: endTimeRaw,
    }),
    project_id: payload.project_id ?? null,
    label,
    source,
  }));

  const insertBuilder = supabase
    .from('daily_assignments')
    .insert(rows);

  const { data: insertedRows, error: insertError } = await insertBuilder
    .select(usingLegacyDailyAssignmentsSchema
      ? 'id, profile_id, assignment_date, project_id, label, source'
      : 'id, profile_id, assignment_date, start_time, end_time, project_id, label, source');

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  return new Response(JSON.stringify({
    ok: true,
    profile_id: profileId,
    date_from: dateFromRaw,
    date_to: dateToRaw,
    start_time: startTimeRaw,
    end_time: endTimeRaw,
    booked_days: insertedRows?.length ?? 0,
    assignments: insertedRows ?? [],
  }), {
    status: 200,
    headers: jsonHeaders,
  });
});
