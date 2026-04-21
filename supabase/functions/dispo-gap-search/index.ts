import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' };

type GapRequest = {
  year?: number;
  week_from?: number;
  week_to?: number;
  min_gap_hours?: number;
  window_start?: string;
  window_end?: string;
  role_label?: string;
  callback_url?: string;
  callback_secret?: string;
};

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

  let payload: GapRequest;
  try {
    payload = (await req.json()) as GapRequest;
  } catch (_error) {
    return new Response(JSON.stringify({ error: 'Ungültiger JSON-Body.' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const now = new Date();
  const year = Number.isInteger(payload.year) ? Number(payload.year) : now.getUTCFullYear();
  const weekFrom = Number(payload.week_from);
  const weekTo = Number.isInteger(payload.week_to) ? Number(payload.week_to) : weekFrom;
  const minGapHours = Number.isFinite(payload.min_gap_hours) ? Number(payload.min_gap_hours) : 4;
  const minGapMinutes = Math.round(minGapHours * 60);
  const windowStart = payload.window_start || '07:00';
  const windowEnd = payload.window_end || '17:00';
  const roleLabel = payload.role_label || 'Service';

  if (!Number.isInteger(weekFrom) || weekFrom < 1 || weekFrom > 53) {
    return new Response(JSON.stringify({ error: 'week_from muss zwischen 1 und 53 liegen.' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }
  if (!Number.isInteger(weekTo) || weekTo < weekFrom || weekTo > 53) {
    return new Response(JSON.stringify({ error: 'week_to muss >= week_from und <= 53 sein.' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return new Response(JSON.stringify({ error: 'year muss zwischen 2000 und 2100 liegen.' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }
  if (!Number.isFinite(minGapMinutes) || minGapMinutes <= 0) {
    return new Response(JSON.stringify({ error: 'min_gap_hours muss > 0 sein.' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.rpc('find_dispo_free_gaps', {
    p_year: year,
    p_week_from: weekFrom,
    p_week_to: weekTo,
    p_min_gap_minutes: minGapMinutes,
    p_window_start: windowStart,
    p_window_end: windowEnd,
    p_role_label: roleLabel,
    p_only_active: true,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const result = {
    params: {
      year,
      week_from: weekFrom,
      week_to: weekTo,
      min_gap_hours: minGapHours,
      window_start: windowStart,
      window_end: windowEnd,
      role_label: roleLabel,
    },
    matches: data ?? [],
    total_matches: Array.isArray(data) ? data.length : 0,
  };

  const callbackUrl = payload.callback_url?.trim();
  if (callbackUrl) {
    try {
      const callbackResponse = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          ...jsonHeaders,
          ...(payload.callback_secret ? { 'x-callback-secret': payload.callback_secret } : {}),
        },
        body: JSON.stringify(result),
      });

      return new Response(JSON.stringify({
        ...result,
        callback: {
          sent: true,
          status: callbackResponse.status,
          ok: callbackResponse.ok,
        },
      }), {
        status: 200,
        headers: jsonHeaders,
      });
    } catch (callbackError) {
      return new Response(JSON.stringify({
        ...result,
        callback: {
          sent: false,
          error: callbackError instanceof Error ? callbackError.message : 'Callback fehlgeschlagen.',
        },
      }), {
        status: 200,
        headers: jsonHeaders,
      });
    }
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: jsonHeaders,
  });
});
