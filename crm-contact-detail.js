const CONFIG_PATH = './supabase-config.json';
const NOTES_TABLE = 'notes';
const CRM_NOTE_TYPE = 'crm';
const CRM_NOTE_STORAGE_BUCKET = 'crm-note-attachments';
const NOTE_CATEGORY_DEFAULT = 'information';
const NOTE_RANKING_DEFAULT = 2;

const state = { supabase: null, user: null, contactId: '', contact: null, notes: [], profiles: [] };
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
  elements.noteForm = document.getElementById('noteForm');
  elements.senderUidInput = document.getElementById('senderUidInput');
  elements.recipientUidInput = document.getElementById('recipientUidInput');
  elements.noteCategoryInput = document.getElementById('noteCategoryInput');
  elements.noteRankingInput = document.getElementById('noteRankingInput');
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
  const [contactResult, notesResult, profilesResult] = await Promise.all([
    state.supabase.from('crm_contacts').select('*').eq('id', state.contactId).single(),
    state.supabase.from(NOTES_TABLE).select('*').eq('note_type', CRM_NOTE_TYPE).eq('target_uid', state.contactId).order('created_at', { ascending: false }),
    state.supabase.from('app_profiles').select('id,full_name,email').order('full_name', { ascending: true }),
  ]);
  if (contactResult.error) throw contactResult.error;
  if (notesResult.error) throw notesResult.error;
  if (profilesResult.error) throw profilesResult.error;

  state.contact = contactResult.data;
  state.notes = notesResult.data || [];
  state.profiles = profilesResult.data || [];
  render();
}

function render() {
  const contact = state.contact;
  elements.contactTitle.textContent = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Kontakt';
  elements.contactMeta.textContent = contact.company_name || 'Ohne Firma';
  elements.contactInfo.innerHTML = [
    ['Kategorie', contact.category || '—'],
    ['Firma', contact.company_name || '—'],
    ['Telefon', contact.phone || '—'],
    ['E-Mail', contact.email || '—'],
    ['Adresse', [contact.street, contact.postal_code, contact.city].filter(Boolean).join(', ') || '—'],
  ].map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`).join('');

  const options = state.profiles.map((profile) => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.full_name || profile.email || profile.id)}</option>`).join('');
  elements.senderUidInput.innerHTML = options;
  elements.recipientUidInput.innerHTML = `<option value="">Offen / kein Empfänger</option>${options}`;
  const defaultSender = state.user?.id || state.profiles[0]?.id || '';
  if (defaultSender) elements.senderUidInput.value = defaultSender;
  elements.noteCategoryInput.value = NOTE_CATEGORY_DEFAULT;
  elements.noteRankingInput.value = String(NOTE_RANKING_DEFAULT);

  if (!state.notes.length) {
    elements.notesList.innerHTML = '<li>Noch keine Notizen vorhanden.</li>';
    return;
  }
  elements.notesList.innerHTML = state.notes.map((note) => {
    const attachments = Array.isArray(note.attachments) ? note.attachments : [];
    const links = attachments.length
      ? `<div>${attachments.map((attachment) => `<a href="${escapeAttribute(attachment.publicUrl || '#')}" target="_blank" rel="noopener">${escapeHtml(attachment.name || 'Anhang')}</a>`).join(' · ')}</div>`
      : '';
    return `<li>
      <strong>${escapeHtml(new Date(note.created_at).toLocaleString('de-CH'))}</strong>
      <div>${escapeHtml(note.note_text || '')}</div>
      <div class="note-meta">Kategorie: ${escapeHtml(note.note_category || 'information')} · Ranking: ${escapeHtml(String(note.note_ranking || 2))} · Sender: ${escapeHtml(note.sender_uid || '—')} · Empfänger: ${escapeHtml(note.recipient_uid || 'offen')}</div>
      ${links}
    </li>`;
  }).join('');
}

async function handleSubmitNote(event) {
  event.preventDefault();
  const senderUid = String(elements.senderUidInput.value || '').trim();
  const recipientUid = String(elements.recipientUidInput.value || '').trim();
  const noteText = String(elements.noteTextInput.value || '').trim();
  const noteCategory = String(elements.noteCategoryInput.value || NOTE_CATEGORY_DEFAULT).trim().toLowerCase();
  const noteRanking = Math.max(1, Math.min(3, Number(elements.noteRankingInput.value || NOTE_RANKING_DEFAULT)));
  if (!senderUid || !noteText) {
    showAlert('Absender und Kommentar sind Pflicht.', true);
    return;
  }

  try {
    const attachments = await uploadAttachments(senderUid, state.contactId, elements.noteAttachmentInput.files);
    const { error } = await state.supabase.from(NOTES_TABLE).insert({
      target_uid: state.contactId,
      note_type: CRM_NOTE_TYPE,
      note_text: noteText,
      sender_uid: senderUid,
      recipient_uid: recipientUid || null,
      note_category: noteCategory || NOTE_CATEGORY_DEFAULT,
      note_ranking: noteRanking,
      attachments,
    });
    if (error) throw error;

    elements.noteForm.reset();
    showAlert('Notiz gespeichert.', false);
    await loadData();
  } catch (error) {
    showAlert(`Notiz konnte nicht gespeichert werden: ${error.message}`, true);
  }
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
