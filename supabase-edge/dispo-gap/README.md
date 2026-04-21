# Dispo-Gap Edge-Funktion (Supabase + n8n)

Dieses Paket enthält:

- `dispo_gap_search.sql` → SQL/RPC-Funktion für die Lückensuche (KW-Bereich, Mindestdauer, Zeitfenster).
- `supabase/functions/dispo-gap-search/index.ts` → Edge-Funktion als HTTP-Endpunkt.

## 1) SQL in Supabase ausführen

1. Öffne in Supabase **SQL Editor**.
2. Kopiere den Inhalt aus `dispo_gap_search.sql`.
3. Ausführen.

Dadurch wird die RPC-Funktion `public.find_dispo_free_gaps(...)` erstellt.

## 2) Edge-Funktion deployen

```bash
supabase functions deploy dispo-gap-search --no-verify-jwt
```

> `--no-verify-jwt` ist praktisch für Webhook-Calls aus n8n. Alternativ ohne Flag deployen und mit JWT aufrufen.

## 3) Request-Body der Edge-Funktion

`POST /functions/v1/dispo-gap-search`

```json
{
  "year": 2026,
  "week_from": 13,
  "week_to": 18,
  "min_gap_hours": 4,
  "window_start": "07:00",
  "window_end": "17:00",
  "role_label": "Service",
  "callback_url": "https://n8n.example.com/webhook/dispo-gaps",
  "callback_secret": "mein-shared-secret"
}
```

### Bedeutungen

- `year`: ISO-Jahr.
- `week_from`, `week_to`: Kalenderwochenbereich (z. B. 13 bis 18).
- `min_gap_hours`: Mindestlücke in Stunden (z. B. `4`).
- `window_start`, `window_end`: Suchfenster pro Tag.
- `role_label`: Standard `Service`.
- `callback_url` (optional): Falls gesetzt, sendet die Edge-Funktion Ergebnis zusätzlich per POST an diese URL.
- `callback_secret` (optional): Wird als Header `x-callback-secret` an den Callback gesendet.

## 4) n8n-Beispiel (HTTP Request Node)

### Option A: n8n triggert Supabase aktiv

1. **Cron Node** (z. B. täglich 06:00).
2. **HTTP Request Node**:
   - Method: `POST`
   - URL: `https://<PROJECT_REF>.supabase.co/functions/v1/dispo-gap-search`
   - Header:
     - `Authorization: Bearer <SUPABASE_ANON_OR_SERVICE_KEY>`
     - `Content-Type: application/json`
   - Body: JSON wie oben (ohne `callback_url`, wenn du direkt in n8n weiterarbeitest).
3. Nachfolgende Nodes (IF, Slack, E-Mail, etc.) nutzen `matches` aus der Antwort.

### Option B: Supabase ruft n8n per Callback

1. In n8n einen **Webhook Node** anlegen (`POST`).
2. Dessen URL als `callback_url` in den Body der Edge-Funktion schicken.
3. Optional im Webhook prüfen:
   - Header `x-callback-secret` == erwarteter Wert.
4. Danach Ergebnis verarbeiten (z. B. Benachrichtigung / Terminlogik).

## 5) Beispielantwort

```json
{
  "params": {
    "year": 2026,
    "week_from": 13,
    "week_to": 18,
    "min_gap_hours": 4,
    "window_start": "07:00",
    "window_end": "17:00",
    "role_label": "Service"
  },
  "matches": [
    {
      "profile_id": "...",
      "profile_name": "Max Muster",
      "role_label": "Service",
      "work_date": "2026-04-01",
      "iso_year": 2026,
      "iso_week": 14,
      "free_start": "12:00:00",
      "free_end": "17:00:00",
      "free_minutes": 300,
      "is_full_day": false
    }
  ],
  "total_matches": 1
}
```

## 6) cURL Test

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/dispo-gap-search" \
  -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2026,
    "week_from": 13,
    "week_to": 18,
    "min_gap_hours": 4,
    "window_start": "07:00",
    "window_end": "17:00",
    "role_label": "Service"
  }'
```
