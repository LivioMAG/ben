const CONFIG_PATH = './supabase-config.json';
const PROPERTIES_TABLE = 'properties';
const CRM_CONTACTS_TABLE = 'crm_contacts';
const PROPERTY_DOCUMENT_STORAGE_BUCKET = 'crm-note-attachments';

const state = { supabase: null, propertyId: '', property: null, contact: null, user: null };
const elements = {};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  cacheElements();
  bindEvents();
  const params = new URLSearchParams(window.location.search);
  state.propertyId = String(params.get('propertyId') || '').trim();
  if (!state.propertyId) {
    showAlert('Immobilien-ID fehlt.', true);
    return;
  }
  await initializeSupabase();
  await loadData();
}

function cacheElements() {
  elements.propertyTitle = document.getElementById('propertyTitle');
  elements.propertyMeta = document.getElementById('propertyMeta');
  elements.propertyInfo = document.getElementById('propertyInfo');
  elements.documentsList = document.getElementById('documentsList');
  elements.documentForm = document.getElementById('documentForm');
  elements.documentFileInput = document.getElementById('documentFileInput');
  elements.noteForm = document.getElementById('noteForm');
  elements.noteTextInput = document.getElementById('noteTextInput');
  elements.notesList = document.getElementById('notesList');
  elements.backButton = document.getElementById('backButton');
  elements.alert = document.getElementById('alert');
}

function bindEvents() {
  elements.backButton?.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = './index.html';
  });
  elements.noteForm?.addEventListener('submit', handleNoteSubmit);
  elements.documentForm?.addEventListener('submit', handleDocumentSubmit);
}

async function initializeSupabase() {
  const config = await fetch(CONFIG_PATH, { cache: 'no-store' }).then((res) => res.json());
  state.supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  const { data: sessionData } = await state.supabase.auth.getSession();
  state.user = sessionData?.session?.user || null;
}

async function loadData() {
  const propertyResult = await state.supabase.from(PROPERTIES_TABLE).select('*').eq('id', state.propertyId).single();
  if (propertyResult.error) throw propertyResult.error;
  state.property = propertyResult.data;

  if (state.property?.contact_id) {
    const contactResult = await state.supabase.from(CRM_CONTACTS_TABLE).select('*').eq('id', state.property.contact_id).single();
    if (!contactResult.error) {
      state.contact = contactResult.data;
    }
  }

  render();
}

function render() {
  const property = state.property;
  if (!property) return;

  elements.propertyTitle.textContent = property.name || 'Immobilie';
  elements.propertyMeta.textContent = [property.strasse, [property.postleitzahl, property.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—';

  elements.propertyInfo.innerHTML = [
    ['Kontakt', getContactDisplayName(state.contact)],
    ['Strasse', property.strasse || '—'],
    ['PLZ / Ort', [property.postleitzahl, property.ort].filter(Boolean).join(' ') || '—'],
    ['Budget', formatCurrency(Number(property.budget || 0))],
  ].map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`).join('');

  const documents = Array.isArray(property.dokumente) ? property.dokumente : [];
  if (!documents.length) {
    elements.documentsList.innerHTML = 'Noch keine Dokumente vorhanden.';
  } else {
    elements.documentsList.innerHTML = `<ul class="documents-list">${documents.map((document) => {
      const url = getAttachmentUrl(document);
      const label = String(document?.name || 'Dokument');
      if (!url) return `<li>${escapeHtml(label)}</li>`;
      return `<li><a href="${escapeAttribute(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a></li>`;
    }).join('')}</ul>`;
  }

  const notes = Array.isArray(property.notizen) ? [...property.notizen].reverse() : [];
  if (!notes.length) {
    elements.notesList.innerHTML = '<li>Noch keine Notizen vorhanden.</li>';
  } else {
    elements.notesList.innerHTML = notes.map((note) => {
      const created = note.created_at ? new Date(note.created_at).toLocaleString('de-CH') : 'Unbekanntes Datum';
      return `<li>
        <strong>${escapeHtml(created)}</strong>
        <div>${escapeHtml(String(note.text || ''))}</div>
        <div class="note-meta">Autor: ${escapeHtml(String(note.author || 'Unbekannt'))}</div>
      </li>`;
    }).join('');
  }
}

async function handleNoteSubmit(event) {
  event.preventDefault();
  const noteText = String(elements.noteTextInput?.value || '').trim();
  if (!noteText) {
    showAlert('Bitte zuerst eine Notiz erfassen.', true);
    return;
  }

  const notes = Array.isArray(state.property?.notizen) ? [...state.property.notizen] : [];
  notes.push({ text: noteText, author: getCurrentAuthorName(), created_at: new Date().toISOString() });

  try {
    const { error } = await state.supabase.from(PROPERTIES_TABLE).update({ notizen: notes }).eq('id', state.property.id);
    if (error) throw error;
    elements.noteTextInput.value = '';
    showAlert('Notiz gespeichert.', false);
    await loadData();
  } catch (error) {
    showAlert(`Notiz konnte nicht gespeichert werden: ${error.message}`, true);
  }
}

async function handleDocumentSubmit(event) {
  event.preventDefault();
  const files = Array.from(elements.documentFileInput?.files || []);
  if (!files.length) {
    showAlert('Bitte mindestens ein Dokument auswählen.', true);
    return;
  }

  try {
    const uploadedDocs = await uploadDocuments(state.property.id, files);
    const existingDocs = Array.isArray(state.property?.dokumente) ? [...state.property.dokumente] : [];
    const nextDocuments = existingDocs.concat(uploadedDocs);
    const { error } = await state.supabase.from(PROPERTIES_TABLE).update({ dokumente: nextDocuments }).eq('id', state.property.id);
    if (error) throw error;
    elements.documentFileInput.value = '';
    showAlert('Dokumente gespeichert.', false);
    await loadData();
  } catch (error) {
    showAlert(`Dokumente konnten nicht gespeichert werden: ${error.message}`, true);
  }
}

async function uploadDocuments(propertyId, files) {
  const safePropertyId = String(propertyId || 'neu').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'neu';
  const uploads = [];

  for (const file of files) {
    const safeName = String(file.name || 'dokument').trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'dokument';
    const path = `properties/${safePropertyId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const { error } = await state.supabase.storage.from(PROPERTY_DOCUMENT_STORAGE_BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    });
    if (error) throw error;

    const { data } = state.supabase.storage.from(PROPERTY_DOCUMENT_STORAGE_BUCKET).getPublicUrl(path);
    uploads.push({
      name: file.name || safeName,
      mimeType: file.type || 'application/octet-stream',
      size: file.size || 0,
      bucket: PROPERTY_DOCUMENT_STORAGE_BUCKET,
      path,
      publicUrl: String(data?.publicUrl || '').trim(),
      created_at: new Date().toISOString(),
    });
  }

  return uploads;
}

function getAttachmentUrl(document) {
  if (!document || typeof document !== 'object') return '';
  if (document.publicUrl) return String(document.publicUrl);
  const path = String(document.path || '').trim();
  const bucket = String(document.bucket || PROPERTY_DOCUMENT_STORAGE_BUCKET).trim() || PROPERTY_DOCUMENT_STORAGE_BUCKET;
  if (!path || !bucket) return '';
  const { data } = state.supabase.storage.from(bucket).getPublicUrl(path);
  return String(data?.publicUrl || '').trim();
}

function getContactDisplayName(contact) {
  if (!contact) return '—';
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim();
  if (contact.company_name && fullName) return `${contact.company_name} · ${fullName}`;
  return contact.company_name || fullName || '—';
}

function getCurrentAuthorName() {
  const metadataName = String(state.user?.user_metadata?.full_name || '').trim();
  if (metadataName) return metadataName;
  const metadataDisplayName = String(state.user?.user_metadata?.name || '').trim();
  if (metadataDisplayName) return metadataDisplayName;
  const email = String(state.user?.email || '').trim();
  return email || 'Admin';
}

function formatCurrency(value) {
  return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 2 }).format(Number(value || 0));
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
