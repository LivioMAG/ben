import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' };

type BookPersonRequest = {
  profile_id?: string;
  date_from?: string;
  date_to?: string;
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

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: conflicts, error: conflictsError } = await supabase
    .from('daily_assignments')
    .select('id, assignment_date, label')
    .eq('profile_id', profileId)
    .gte('assignment_date', dateFromRaw)
    .lte('assignment_date', dateToRaw)
    .order('assignment_date', { ascending: true });

  if (conflictsError) {
    return new Response(JSON.stringify({ error: conflictsError.message }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  if (conflicts && conflicts.length > 0) {
    return new Response(JSON.stringify({
      error: 'Diese Person ist an mindestens einem Tag bereits im Dispo verbucht.',
      conflict_days: conflicts.map((entry) => ({
        assignment_date: entry.assignment_date,
        label: entry.label,
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
    project_id: payload.project_id ?? null,
    label,
    source,
  }));

  const { data: insertedRows, error: insertError } = await supabase
    .from('daily_assignments')
    .insert(rows)
    .select('id, profile_id, assignment_date, project_id, label, source');

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
    booked_days: insertedRows?.length ?? 0,
    assignments: insertedRows ?? [],
  }), {
    status: 200,
    headers: jsonHeaders,
  });
});
