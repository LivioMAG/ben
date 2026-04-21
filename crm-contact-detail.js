const CONFIG_PATH = './supabase-config.json';
const CRM_NOTE_STORAGE_BUCKET = 'crm-note-attachments';

const state = { supabase: null, user: null, contactId: '', contact: null, profiles: [] };
const elements = {};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  cacheElements();
  bindEvents();
  const params = new URLSearchParams(window.location.search);
  state.contactId = String(params.get('contactId') || '').trim();
  if (!state.contactId) {
    showAlert('Kontakt-ID fehlt.', true);
    return;
  }
  await initializeSupabase();
  await loadData();
}

function cacheElements() {
  elements.contactTitle = document.getElementById('contactTitle');
  elements.contactMeta = document.getElementById('contactMeta');
  elements.contactInfo = document.getElementById('contactInfo');
  elements.contactAvatar = document.getElementById('contactAvatar');
  elements.contactCategoryBadge = document.getElementById('contactCategoryBadge');
  elements.noteForm = document.getElementById('noteForm');
  elements.noteTextInput = document.getElementById('noteTextInput');
  elements.noteAttachmentInput = document.getElementById('noteAttachmentInput');
  elements.notesList = document.getElementById('notesList');
  elements.backButton = document.getElementById('backButton');
  elements.alert = document.getElementById('alert');
}

function bindEvents() {
  elements.backButton?.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = './index.html';
  });
  elements.noteForm?.addEventListener('submit', handleSubmitNote);
}

async function initializeSupabase() {
  const config = await fetch(CONFIG_PATH, { cache: 'no-store' }).then((res) => res.json());
  state.supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  const { data: sessionData } = await state.supabase.auth.getSession();
  state.user = sessionData?.session?.user || null;
}

async function loadData() {
  const [contactResult, profilesResult] = await Promise.all([
    state.supabase.from('crm_contacts').select('*').eq('id', state.contactId).single(),
    state.supabase.from('app_profiles').select('id,full_name,email').order('full_name', { ascending: true }),
  ]);
  if (contactResult.error) throw contactResult.error;
  if (profilesResult.error) throw profilesResult.error;

  state.contact = contactResult.data;
  state.profiles = profilesResult.data || [];
  render();
}

function render() {
  const contact = state.contact;
  const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Kontakt';
  const category = contact.category || 'Ohne Kategorie';
  const company = contact.company_name || 'Ohne Firma';
  elements.contactTitle.textContent = fullName;
  elements.contactMeta.textContent = company;
  elements.contactCategoryBadge.textContent = category;
  elements.contactAvatar.textContent = getInitials(contact.first_name, contact.last_name);
  elements.contactInfo.innerHTML = [
    ['Firma', company],
    ['Kategorie', category],
    ['Telefon', contact.phone || '—'],
    ['E-Mail', contact.email || '—'],
    ['Adresse', [contact.street, contact.postal_code, contact.city].filter(Boolean).join(', ') || '—'],
  ].map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');

  const notes = normalizeContactNotes(contact.notizen);
  if (!notes.length) {
    elements.notesList.innerHTML = '<li>Noch keine Notizen vorhanden.</li>';
    return;
  }
  elements.notesList.innerHTML = notes.slice().reverse().map((note) => {
    const createdAt = formatDate(note.createdAt || note.created_at);
    const author = resolveProfileLabel(note.authorUid || note.author_uid);
    const attachments = Array.isArray(note.attachments) ? note.attachments : [];
    const links = attachments.length
      ? `<ul class="attachments">${attachments.map((attachment) => `<li><span class="doc-name">${escapeHtml(attachment.name || 'Anhang')}</span><a class="doc-link" href="${escapeAttribute(attachment.publicUrl || '#')}" target="_blank" rel="noopener">Öffnen</a></li>`).join('')}</ul>`
      : '';
    return `<li>
      <div class="note-card-header"><strong class="note-date">${escapeHtml(createdAt)}</strong></div>
      <div class="note-text">${escapeHtml(note.text || '')}</div>
      <div class="note-meta">Autor: ${escapeHtml(author)}</div>
      ${links}
    </li>`;
  }).join('');
}

async function handleSubmitNote(event) {
  event.preventDefault();
  const noteText = String(elements.noteTextInput.value || '').trim();
  if (!noteText) {
    showAlert('Notiztext ist Pflicht.', true);
    return;
  }

  try {
    const authorUid = state.user?.id || '';
    const attachments = await uploadAttachments(authorUid || 'system', state.contactId, elements.noteAttachmentInput.files);
    const currentNotes = normalizeContactNotes(state.contact?.notizen);
    const nextNotes = [
      ...currentNotes,
      {
        id: crypto.randomUUID(),
        text: noteText,
        authorUid,
        createdAt: new Date().toISOString(),
        attachments,
      },
    ];

    const { error } = await state.supabase
      .from('crm_contacts')
      .update({ notizen: nextNotes })
      .eq('id', state.contactId);

    if (error) throw error;

    elements.noteForm.reset();
    showAlert('Notiz gespeichert.', false);
    await loadData();
  } catch (error) {
    showAlert(`Notiz konnte nicht gespeichert werden: ${error.message}`, true);
  }
}

function normalizeContactNotes(value) {
  if (Array.isArray(value)) return value.filter((entry) => entry && typeof entry === 'object');
  return [];
}

function resolveProfileLabel(profileId) {
  if (!profileId) return 'Unbekannt';
  const profile = state.profiles.find((entry) => String(entry.id) === String(profileId));
  return profile ? (profile.full_name || profile.email || profile.id) : profileId;
}


function getInitials(firstName, lastName) {
  const initials = [firstName, lastName]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .map((value) => value.charAt(0).toUpperCase())
    .join('');
  return initials || 'K';
}

function formatDate(value) {
  if (!value) return 'Unbekanntes Datum';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('de-CH');
}

async function uploadAttachments(senderUid, contactId, fileList) {
  const files = Array.from(fileList || []).filter((file) => String(file.type || '').toLowerCase() === 'application/pdf' || String(file.name || '').toLowerCase().endsWith('.pdf'));
  if (!files.length) return [];
  const entries = [];
  for (const file of files) {
    const path = `${senderUid}/${contactId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
    const { error } = await state.supabase.storage.from(CRM_NOTE_STORAGE_BUCKET).upload(path, file, { upsert: false, contentType: file.type || 'application/pdf' });
    if (error) throw error;
    const { data } = state.supabase.storage.from(CRM_NOTE_STORAGE_BUCKET).getPublicUrl(path);
    entries.push({ name: file.name, mimeType: file.type || 'application/pdf', size: file.size, path, bucket: CRM_NOTE_STORAGE_BUCKET, publicUrl: data?.publicUrl || '' });
  }
  return entries;
}

function sanitizeFileName(name) {
  return String(name || 'attachment.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function showAlert(message, isError) {
  if (!elements.alert) return;
  elements.alert.textContent = message;
  elements.alert.classList.remove('hidden', 'error', 'success');
  elements.alert.classList.add(isError ? 'error' : 'success');
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
