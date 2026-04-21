alter table public.dashboard_notes
  add column if not exists preview_text text not null default '';

alter table public.dashboard_notes
  alter column content type jsonb
  using (
    case
      when content is null or btrim(content) = '' then '[]'::jsonb
      else jsonb_build_array(
        jsonb_build_object(
          'role', 'user',
          'text', content,
          'created_at', coalesce(created_at, timezone('utc', now()))
        )
      )
    end
  );

alter table public.dashboard_notes
  alter column content set default '[]'::jsonb;

update public.dashboard_notes
set preview_text = coalesce(
  nullif(preview_text, ''),
  nullif(content -> -1 ->> 'text', ''),
  ''
);
