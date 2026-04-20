# Wochenrapport Webplattform

Statische Desktop-Webplattform mit HTML, CSS und JavaScript für:

- Login über Supabase Auth
- zentrale Wochenrapport-Übersicht mit Wochenfilter
- separate Seite für Ferien- und Absenzanträge
- CRM-Seite mit Kontakten (5 Kategorien) und separaten Notizen über UID-Referenz (Tabelle `notes`, `note_type` z. B. `crm`)
- Vollzugriff auf die Web-Visualisierung nur für Profile mit `app_profiles.is_admin = true`
- kombinierten PDF-Export pro Kalenderwoche inklusive fehlender Rapporte und Bildanhängen

## Dateien

- `index.html`: Layout der Webplattform
- `style.css`: Desktop-/Responsive-Styling
- `script.js`: Login, Supabase-Integration, Datenabfragen, Rendering und PDF-Export
- `supabase-schema.sql`: Tabellen, Trigger, RLS und Storage-Policies mit Vollzugriff über `is_admin`
- `supabase-config.example.json`: Vorlage für die lokale Supabase-Konfiguration

## Lokale Nutzung

1. `supabase-config.example.json` nach `supabase-config.json` kopieren.
2. Projekt-URL und Anon-Key eintragen.
3. Die Seite über einen statischen Webserver öffnen, z. B.:
   - `python3 -m http.server 4173`
4. Dann im Browser `http://localhost:4173` öffnen.

## Hinweise

- Ohne `supabase-config.json` läuft die Oberfläche automatisch im Demo-Modus.
- Für den produktiven Einsatz muss das SQL aus `supabase-schema.sql` im Supabase-Projekt
  ausgeführt werden, damit Profile mit `is_admin = true` die Daten im Frontend vollständig
  sehen und bearbeiten können.
- Der PDF-Export nutzt `jsPDF` und `jspdf-autotable` direkt per CDN.
- Wenn ein Browser bei geöffneten PDF-Dateien „PDF-Bearbeitung wird nicht unterstützt“ meldet, den Link „PDF herunterladen“ nutzen: dieser erzwingt den Datei-Download (statt Browser-Viewer), damit die Datei lokal in einer PDF-App (z. B. Adobe Acrobat) bearbeitet werden kann.
- Anhänge werden auch dann korrekt verlinkt, wenn nur ein Storage-Pfad (ohne `publicUrl`) gespeichert ist; die Web-App erzeugt dafür automatisch die öffentliche URL aus dem Bucket.

## SQL-Fehlerbehebung

- Fehler wie `syntax error at or near "@@"` bedeuten fast immer, dass versehentlich Git-Diff-Zeilen in den SQL-Editor kopiert wurden (z. B. `@@ -52,53 +53,63 @@`, `+`, `-` am Zeilenanfang).
- Im Supabase-SQL-Editor darf nur gültiges SQL ausgeführt werden. Entferne alle Diff-Marker und führe danach das bereinigte Skript erneut aus.
- Verwende am besten direkt den Inhalt aus `supabase-schema.sql` (ohne Pull-Request-/Patch-Ansicht zu kopieren).
- Fehler wie `Could not find the table 'public.project_assignments' in the schema cache` weisen auf veraltete Abfragen hin. Die aktuelle App-Version nutzt diese Tabelle nicht mehr; führe `supabase-schema.sql` erneut aus und entferne alte Queries gegen `project_assignments`.
