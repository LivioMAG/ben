const CONFIG_PATH = './supabase-config.json';
const NOTES_TABLE = 'notes';
const PROJECT_NOTE_TYPE = 'pro';
const DISCO_LAYERS_TABLE = 'project_disco_layers';
const DISCO_ENTRIES_TABLE = 'project_disco_entries';
const NOTE_STORAGE_BUCKET = 'crm-note-attachments';
const GRID_SIZE = 24;
const DEFAULT_NOTE_CATEGORY = 'information';
const NOTE_CARD_WIDTH = 148;
const NOTE_CARD_HEIGHT = 136;
const NOTE_PREVIEW_LENGTH = 60;
const NOTE_FLOW_FALLBACK_NAME = 'Unbekannt';
const NOTE_CATEGORY_INFO = 'information';
const NOTE_CATEGORY_TASK = 'aufgabe';
const NOTE_CATEGORY_TITLE = 'titel';

const state = {
  supabase: null,
  user: null,
  projectId: '',
  profiles: [],
  notes: [],
  activeNote: null,
  pendingPosition: { x: GRID_SIZE, y: GRID_SIZE },
  drag: null,
  showHiddenNotes: false,
  activeView: 'dashboard',
  discoWeekStart: null,
  discoLayerProfileIds: [],
  discoLayers: [],
  discoEntries: [],
  discoDragNoteId: null,
  mainDispoByProfileDate: new Set(),
};

const elements = {};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  cacheElements();
  bindEvents();
  state.discoWeekStart = getWeekStart(new Date());
  switchView('dashboard');
  hydrateMeta();
  await initializeSupabase();
  await loadData();
}

function cacheElements() {
  elements.projectMeta = document.getElementById('projectMeta');
  elements.dashboardNavButton = document.getElementById('dashboardNavButton');
  elements.discoNavButton = document.getElementById('discoNavButton');
  elements.notesDashboardArea = document.getElementById('notesDashboardArea');
  elements.discoArea = document.getElementById('discoArea');
  elements.backButton = document.getElementById('backIconButton');
  elements.toggleHiddenNotesButton = document.getElementById('toggleHiddenNotesButton');
  elements.createNoteButton = document.getElementById('createNoteButton');
  elements.createTitleNoteButton = document.getElementById('createTitleNoteButton');
  elements.canvas = document.getElementById('dashboardCanvas');
  elements.alert = document.getElementById('statusAlert');
  elements.modal = document.getElementById('noteModal');
  elements.closeNoteModalButton = document.getElementById('closeNoteModalButton');
  elements.noteForm = document.getElementById('noteForm');
  elements.recipientUidInput = document.getElementById('recipientUidInput');
  elements.noteCategoryInput = document.getElementById('noteCategoryInput');
  elements.noteTextInput = document.getElementById('noteTextInput');
  elements.visibleFromInput = document.getElementById('visibleFromInput');
  elements.noteAttachmentInput = document.getElementById('noteAttachmentInput');
  elements.deleteNoteButton = document.getElementById('deleteNoteButton');
  elements.existingAttachments = document.getElementById('existingAttachments');
  elements.noteFlowList = document.getElementById('noteFlowList');
  elements.discoPreviousWeekButton = document.getElementById('discoPreviousWeekButton');
  elements.discoNextWeekButton = document.getElementById('discoNextWeekButton');
  elements.discoWeekLabel = document.getElementById('discoWeekLabel');
  elements.discoOpenTasksList = document.getElementById('discoOpenTasksList');
  elements.discoTableHead = document.getElementById('discoTableHead');
  elements.discoTableBody = document.getElementById('discoTableBody');
  elements.openDiscoLayerPickerButton = document.getElementById('openDiscoLayerPickerButton');
  elements.discoLayerModal = document.getElementById('discoLayerModal');
  elements.discoLayerForm = document.getElementById('discoLayerForm');
  elements.discoLayerProfileInput = document.getElementById('discoLayerProfileInput');
  elements.closeDiscoLayerModalButton = document.getElementById('closeDiscoLayerModalButton');
}

function bindEvents() {
  elements.backButton?.addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = './index.html';
  });
  elements.toggleHiddenNotesButton?.addEventListener('click', toggleHiddenNotesView);
  elements.createNoteButton?.addEventListener('click', handleCreateNoteAtCenter);
  elements.createTitleNoteButton?.addEventListener('click', handleCreateTitleNote);
  elements.dashboardNavButton?.addEventListener('click', () => switchView('dashboard'));
  elements.discoNavButton?.addEventListener('click', () => switchView('disco'));

  elements.canvas?.addEventListener('dblclick', handleCanvasDoubleClick);
  elements.canvas?.addEventListener('pointerdown', handleCanvasPointerDown);
  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
  window.addEventListener('resize', handleWindowResize);

  elements.noteForm?.addEventListener('submit', handleSaveNote);
  elements.noteCategoryInput?.addEventListener('change', handleNoteCategoryChange);
  elements.closeNoteModalButton?.addEventListener('click', closeModal);
  elements.modal?.addEventListener('click', (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeNoteModal === 'true') {
      closeModal();
    }
  });
  elements.deleteNoteButton?.addEventListener('click', handleDeleteNote);
  elements.discoPreviousWeekButton?.addEventListener('click', async () => shiftDiscoWeek(-7));
  elements.discoNextWeekButton?.addEventListener('click', async () => shiftDiscoWeek(7));
  elements.openDiscoLayerPickerButton?.addEventListener('click', openDiscoLayerModal);
  elements.closeDiscoLayerModalButton?.addEventListener('click', closeDiscoLayerModal);
  elements.discoLayerForm?.addEventListener('submit', handleDiscoLayerSubmit);
  elements.discoLayerModal?.addEventListener('click', (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeDiscoLayerModal === 'true') {
      closeDiscoLayerModal();
    }
  });
  elements.discoTableBody?.addEventListener('click', handleDiscoTableClick);
  updateHiddenToggleButton();
}

function hydrateMeta() {
  const params = new URLSearchParams(window.location.search);
  const commission = (params.get('commission') || '').trim();
  const name = (params.get('name') || '').trim();
  state.projectId = (params.get('projectId') || '').trim();
  const meta = [commission, name].filter(Boolean).join(' · ');

  if (elements.projectMeta) {
    elements.projectMeta.textContent = meta;
    elements.projectMeta.hidden = meta.length === 0;
  }

  if (!state.projectId) {
    showAlert('Projekt-ID fehlt. Notizen können nicht geladen werden.', true);
  }
}

async function initializeSupabase() {
  const config = await fetch(CONFIG_PATH, { cache: 'no-store' }).then((res) => res.json());
  state.supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  const { data: sessionData } = await state.supabase.auth.getSession();
  state.user = sessionData?.session?.user || null;
}

async function loadData() {
  if (!state.projectId) return;

  try {
    const weekStart = getWeekStart(state.discoWeekStart || new Date());
    const weekDates = getWeekDates(weekStart);
    const weekStartKey = formatDateKey(weekDates[0]);
    const weekEndKey = formatDateKey(weekDates[6]);

    const [notesResult, profilesResult, layersResult, entriesResult, mainDispoResult] = await Promise.all([
      state.supabase.from(NOTES_TABLE).select('*').eq('note_type', PROJECT_NOTE_TYPE).eq('target_uid', state.projectId).order('created_at', { ascending: false }),
      state.supabase.from('app_profiles').select('id,full_name,email').order('full_name', { ascending: true }),
      state.supabase.from(DISCO_LAYERS_TABLE).select('*').eq('project_id', state.projectId).order('sort_order', { ascending: true }),
      state.supabase.from(DISCO_ENTRIES_TABLE).select('*').eq('project_id', state.projectId).order('sort_order', { ascending: true }),
      state.supabase.from('daily_assignments').select('profile_id, assignment_date').eq('project_id', state.projectId).gte('assignment_date', weekStartKey).lte('assignment_date', weekEndKey),
    ]);

    if (notesResult.error) throw notesResult.error;
    if (profilesResult.error) throw profilesResult.error;
    if (layersResult.error && !String(layersResult.error.message || '').includes('relation')) throw layersResult.error;
    if (entriesResult.error && !String(entriesResult.error.message || '').includes('relation')) throw entriesResult.error;
    if (mainDispoResult.error && !String(mainDispoResult.error.message || '').includes('relation')) throw mainDispoResult.error;

    state.notes = notesResult.data || [];
    state.profiles = profilesResult.data || [];
    state.discoLayers = layersResult.data || [];
    state.discoEntries = entriesResult.data || [];
    state.discoLayerProfileIds = state.discoLayers.map((layer) => String(layer.profile_uid || '')).filter(Boolean);
    state.mainDispoByProfileDate = new Set((mainDispoResult.data || []).map((entry) => `${String(entry.profile_id || '')}:${formatDateKey(entry.assignment_date)}`));

    requestAnimationFrame(() => renderCanvas());
    renderRecipientOptions();
    renderDiscoLayerOptions();
    renderDiscoPlanner();
  } catch (error) {
    showAlert(`Notizen konnten nicht geladen werden: ${error.message}`, true);
  }
}

function renderRecipientOptions() {
  if (!elements.recipientUidInput) return;
  const options = state.profiles
    .map((profile) => `<option value="${escapeAttribute(profile.id)}">${escapeHtml(profile.full_name || profile.email || profile.id)}</option>`)
    .join('');
  elements.recipientUidInput.innerHTML = `<option value="">Niemand</option>${options}`;
}

function renderCanvas() {
  if (!elements.canvas) return;
  elements.canvas.querySelectorAll('.note-icon').forEach((node) => node.remove());

  for (const note of getVisibleNotes()) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'note-icon';
    node.dataset.noteId = String(note.id || '');
    node.dataset.category = normalizeCategory(note.note_category);

    const x = snapToGrid(toFiniteNumber(note.note_pos_x, GRID_SIZE));
    const y = snapToGrid(toFiniteNumber(note.note_pos_y, GRID_SIZE));
    const clamped = clampPosition({ x, y });
    node.style.left = `${clamped.x}px`;
    node.style.top = `${clamped.y}px`;

    const flow = getNoteFlow(note);
    const latestEntry = flow[flow.length - 1] || null;
    const previewText = String(latestEntry?.message || note.note_text || '');
    const previewAuthor = String(latestEntry?.author_name || resolveProfileName(latestEntry?.author_uid) || NOTE_FLOW_FALLBACK_NAME);
    node.title = `${previewAuthor}: ${previewText}`;
    const isTitleOnly = normalizeCategory(note.note_category) === NOTE_CATEGORY_TITLE;
    if (isTitleOnly) {
      node.classList.add('note-icon-title-only');
      node.innerHTML = `<div class="note-icon-title">${escapeHtml(buildTitleFromText(previewText))}</div>`;
    } else {
      const categoryIcon = getCategoryIcon(note.note_category);
      node.innerHTML = `
        <span class="note-category-badge" aria-hidden="true">${escapeHtml(categoryIcon)}</span>
        <div class="note-icon-title">${escapeHtml(buildTitleFromText(previewText))}</div>
      `;
    }
    node.addEventListener('dblclick', async (event) => {
      event.stopPropagation();
      if (isTitleOnly) {
        await deleteTitleNote(note.id);
        return;
      }
      openModalForNote(note.id);
    });
    elements.canvas.appendChild(node);
  }
}

function handleCanvasDoubleClick(event) {
  if (!(event.target instanceof HTMLElement)) return;
  if (event.target.closest('.note-icon')) return;

  const rect = elements.canvas.getBoundingClientRect();
  const x = snapToGrid(event.clientX - rect.left - NOTE_CARD_WIDTH / 2);
  const y = snapToGrid(event.clientY - rect.top - NOTE_CARD_HEIGHT / 2);
  state.pendingPosition = clampPosition({ x, y });
  openModalForCreate();
}

function handleCanvasPointerDown(event) {
  const noteNode = event.target instanceof HTMLElement ? event.target.closest('.note-icon') : null;
  if (!noteNode || !(noteNode instanceof HTMLElement)) return;

  const noteId = String(noteNode.dataset.noteId || '');
  const rect = elements.canvas.getBoundingClientRect();
  const left = parseFloat(noteNode.style.left || '0');
  const top = parseFloat(noteNode.style.top || '0');

  state.drag = {
    noteId,
    offsetX: event.clientX - rect.left - left,
    offsetY: event.clientY - rect.top - top,
    node: noteNode,
    hasMoved: false,
  };
  noteNode.classList.add('dragging');
  noteNode.setPointerCapture(event.pointerId);
}

function getCanvasCenterPosition() {
  if (!elements.canvas) return { x: GRID_SIZE * 2, y: GRID_SIZE * 2 };
  const centerX = snapToGrid((elements.canvas.clientWidth - NOTE_CARD_WIDTH) / 2);
  const centerY = snapToGrid((elements.canvas.clientHeight - NOTE_CARD_HEIGHT) / 2);
  return clampPosition({ x: centerX, y: centerY });
}

function handleCreateNoteAtCenter() {
  state.pendingPosition = getCanvasCenterPosition();
  openModalForCreate();
}

async function handleCreateTitleNote() {
  if (!state.projectId) return;
  const senderUid = String(state.user?.id || '').trim();
  if (!senderUid) {
    showAlert('Aktiver Benutzer fehlt.', true);
    return;
  }
  const text = window.prompt('Titel eingeben:', 'Neuer Titel');
  if (text === null) return;
  const titleText = String(text || '').trim();
  if (!titleText) return;

  const center = getCanvasCenterPosition();
  try {
    const { error } = await state.supabase.from(NOTES_TABLE).insert({
      target_uid: state.projectId,
      note_type: PROJECT_NOTE_TYPE,
      note_text: titleText,
      sender_uid: senderUid,
      recipient_uid: null,
      note_category: NOTE_CATEGORY_TITLE,
      visible_from_date: null,
      requires_response: false,
      note_ranking: 1,
      attachments: [],
      note_flow: [],
      note_pos_x: center.x,
      note_pos_y: center.y,
    });
    if (error) throw error;
    showAlert('Titel-Notiz erstellt.', false);
    await loadData();
  } catch (error) {
    showAlert(`Titel konnte nicht erstellt werden: ${error.message}`, true);
  }
}

function handlePointerMove(event) {
  if (!state.drag || !elements.canvas) return;
  state.drag.hasMoved = true;

  const rect = elements.canvas.getBoundingClientRect();
  const x = snapToGrid(event.clientX - rect.left - state.drag.offsetX);
  const y = snapToGrid(event.clientY - rect.top - state.drag.offsetY);
  const clamped = clampPosition({ x, y });

  state.drag.node.style.left = `${clamped.x}px`;
  state.drag.node.style.top = `${clamped.y}px`;
}

async function handlePointerUp() {
  if (!state.drag) return;
  const drag = state.drag;
  state.drag = null;
  drag.node.classList.remove('dragging');

  if (!drag.hasMoved) return;
  const x = snapToGrid(parseFloat(drag.node.style.left || '0'));
  const y = snapToGrid(parseFloat(drag.node.style.top || '0'));

  const existing = state.notes.find((note) => String(note.id) === String(drag.noteId));
  if (!existing) return;

  try {
    const { error } = await state.supabase.from(NOTES_TABLE).update({ note_pos_x: x, note_pos_y: y }).eq('id', drag.noteId);
    if (error) throw error;

    existing.note_pos_x = x;
    existing.note_pos_y = y;
  } catch (error) {
    showAlert(`Position konnte nicht gespeichert werden: ${error.message}`, true);
  }
}

function openModalForCreate() {
  state.activeNote = null;
  elements.deleteNoteButton?.classList.add('hidden');
  elements.noteForm?.reset();
  elements.noteCategoryInput.value = DEFAULT_NOTE_CATEGORY;
  applyDefaultRecipientByCategory(elements.noteCategoryInput.value);
  if (elements.visibleFromInput) elements.visibleFromInput.value = '';
  if (elements.existingAttachments) {
    elements.existingAttachments.innerHTML = '<span class="subtle-text">Noch keine Anhänge vorhanden.</span>';
  }
  renderFlowList([]);
  elements.modal?.classList.remove('hidden');
}

function handleNoteCategoryChange() {
  if (!state.activeNote) {
    applyDefaultRecipientByCategory(elements.noteCategoryInput?.value);
  }
}

function applyDefaultRecipientByCategory(categoryValue) {
  if (!elements.recipientUidInput) return;
  const normalized = normalizeCategory(categoryValue);
  if (normalized === NOTE_CATEGORY_TASK) {
    elements.recipientUidInput.value = '';
    return;
  }
  const me = String(state.user?.id || '').trim();
  elements.recipientUidInput.value = me;
}

function openModalForNote(noteId) {
  const note = state.notes.find((item) => String(item.id) === String(noteId));
  if (!note) return;
  if (normalizeCategory(note.note_category) === NOTE_CATEGORY_TITLE) return;
  state.activeNote = note;

  elements.noteTextInput.value = '';
  elements.noteCategoryInput.value = normalizeCategory(note.note_category);
  elements.recipientUidInput.value = note.recipient_uid || state.user?.id || '';
  elements.visibleFromInput.value = toDateInputValue(note.visible_from_date);
  elements.noteAttachmentInput.value = '';
  elements.deleteNoteButton?.classList.remove('hidden');

  const attachments = Array.isArray(note.attachments) ? note.attachments : [];
  elements.existingAttachments.innerHTML = attachments.length
    ? `<strong>Vorhandene Anhänge:</strong> ${attachments
      .map((attachment) => `<a href="${escapeAttribute(attachment.publicUrl || '#')}" target="_blank" rel="noopener">${escapeHtml(attachment.name || 'Anhang')}</a>`)
      .join(' · ')}`
    : '<span class="subtle-text">Keine Anhänge vorhanden.</span>';
  renderFlowList(getNoteFlow(note));

  elements.modal?.classList.remove('hidden');
}

async function deleteTitleNote(noteId) {
  if (!window.confirm('Diesen Titel wirklich löschen?')) return;
  try {
    const { error } = await state.supabase.from(NOTES_TABLE).delete().eq('id', noteId);
    if (error) throw error;
    showAlert('Titel gelöscht.', false);
    await loadData();
  } catch (error) {
    showAlert(`Titel konnte nicht gelöscht werden: ${error.message}`, true);
  }
}

function closeModal() {
  elements.modal?.classList.add('hidden');
  state.activeNote = null;
}

async function handleSaveNote(event) {
  event.preventDefault();
  if (!state.projectId) return;

  const senderUid = String(state.user?.id || '').trim();
  const recipientUid = String(elements.recipientUidInput.value || '').trim();
  const noteText = String(elements.noteTextInput.value || '').trim();
  const noteCategory = normalizeCategory(elements.noteCategoryInput.value);
  const visibleFromDate = String(elements.visibleFromInput.value || '').trim() || null;

  if (!senderUid) {
    showAlert('Aktiver Benutzer fehlt.', true);
    return;
  }

  if (!state.activeNote && !noteText) {
    showAlert('Notiztext fehlt.', true);
    return;
  }

  try {
    const newAttachments = await uploadAttachments(senderUid, state.projectId, elements.noteAttachmentInput.files);
    const flowEntry = noteText
      ? buildFlowEntry({
        authorUid: senderUid,
        message: noteText,
        attachments: newAttachments,
      })
      : null;

    if (!state.activeNote) {
      const payload = {
        target_uid: state.projectId,
        note_type: PROJECT_NOTE_TYPE,
        note_text: flowEntry?.message || noteText,
        sender_uid: senderUid,
        recipient_uid: recipientUid || null,
        note_category: noteCategory,
        visible_from_date: visibleFromDate,
        requires_response: false,
        note_ranking: 2,
        attachments: newAttachments,
        note_flow: flowEntry ? [flowEntry] : [],
        note_pos_x: state.pendingPosition.x,
        note_pos_y: state.pendingPosition.y,
      };
      const { error } = await state.supabase.from(NOTES_TABLE).insert(payload);
      if (error) throw error;
      showAlert('Projekt-Notiz gespeichert.', false);
    } else {
      const existingFlow = getNoteFlow(state.activeNote);
      const mergedFlow = flowEntry ? [...existingFlow, flowEntry] : existingFlow;
      const previousAttachments = Array.isArray(state.activeNote.attachments) ? state.activeNote.attachments : [];
      const mergedAttachments = mergedFlow.length
        ? mergedFlow.flatMap((entry) => (Array.isArray(entry.attachments) ? entry.attachments : []))
        : [...previousAttachments, ...newAttachments];
      const { error } = await state.supabase
        .from(NOTES_TABLE)
        .update({
          note_text: flowEntry?.message || state.activeNote.note_text || '',
          recipient_uid: recipientUid || null,
          note_category: noteCategory,
          visible_from_date: visibleFromDate,
          requires_response: false,
          attachments: mergedAttachments,
          note_flow: mergedFlow,
        })
        .eq('id', state.activeNote.id);
      if (error) throw error;
      showAlert('Projekt-Notiz aktualisiert.', false);
    }

    closeModal();
    await loadData();
  } catch (error) {
    showAlert(`Notiz konnte nicht gespeichert werden: ${error.message}`, true);
  }
}

async function handleDeleteNote() {
  if (!state.activeNote) return;
  if (!window.confirm('Diese Notiz wirklich löschen?')) return;

  try {
    const { error } = await state.supabase.from(NOTES_TABLE).delete().eq('id', state.activeNote.id);
    if (error) throw error;

    showAlert('Notiz gelöscht.', false);
    closeModal();
    await loadData();
  } catch (error) {
    showAlert(`Notiz konnte nicht gelöscht werden: ${error.message}`, true);
  }
}

async function uploadAttachments(senderUid, projectId, fileList) {
  const files = Array.from(fileList || []).filter((file) => String(file.type || '').toLowerCase() === 'application/pdf' || String(file.name || '').toLowerCase().endsWith('.pdf'));
  if (!files.length) return [];

  const entries = [];
  for (const file of files) {
    const path = `${senderUid}/${projectId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
    const { error } = await state.supabase.storage.from(NOTE_STORAGE_BUCKET).upload(path, file, { upsert: false, contentType: file.type || 'application/pdf' });
    if (error) throw error;
    const { data } = state.supabase.storage.from(NOTE_STORAGE_BUCKET).getPublicUrl(path);
    entries.push({ name: file.name, mimeType: file.type || 'application/pdf', size: file.size, path, bucket: NOTE_STORAGE_BUCKET, publicUrl: data?.publicUrl || '' });
  }
  return entries;
}

function showAlert(message, isError) {
  if (!elements.alert) return;
  elements.alert.textContent = message;
  elements.alert.classList.remove('hidden', 'error', 'success');
  elements.alert.classList.add(isError ? 'error' : 'success');
}

function buildTitleFromText(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return 'Notiz';
  if (normalized.length <= NOTE_PREVIEW_LENGTH) return normalized;
  return `${normalized.slice(0, NOTE_PREVIEW_LENGTH)}…`;
}

function getCategoryIcon(category) {
  const normalized = normalizeCategory(category);
  if (normalized === NOTE_CATEGORY_TASK) return '🔨';
  if (normalized === NOTE_CATEGORY_TITLE) return 'T';
  return 'i';
}

function normalizeCategory(category) {
  const normalized = String(category || '').trim().toLowerCase();
  if (normalized === NOTE_CATEGORY_TITLE) return NOTE_CATEGORY_TITLE;
  return normalized === NOTE_CATEGORY_TASK ? NOTE_CATEGORY_TASK : NOTE_CATEGORY_INFO;
}

function toggleHiddenNotesView() {
  state.showHiddenNotes = !state.showHiddenNotes;
  updateHiddenToggleButton();
  renderCanvas();
}

function updateHiddenToggleButton() {
  if (!elements.toggleHiddenNotesButton) return;
  const showingHiddenOnly = state.showHiddenNotes;
  elements.toggleHiddenNotesButton.textContent = showingHiddenOnly ? '🙈' : '👁️';
  elements.toggleHiddenNotesButton.title = showingHiddenOnly ? 'Nur unsichtbare Notizen werden angezeigt' : 'Sichtbare Notizen werden angezeigt';
  elements.toggleHiddenNotesButton.setAttribute('aria-label', elements.toggleHiddenNotesButton.title);
}

function getVisibleNotes() {
  const me = String(state.user?.id || '');
  const today = startOfDay(new Date());
  if (!me) return [];
  return state.notes.filter((note) => {
    const recipientUid = String(note.recipient_uid || '');
    const senderUid = String(note.sender_uid || '');
    const isRecipient = recipientUid === me;
    const isSender = senderUid === me;
    if (!isRecipient && !isSender) return false;
    const visibilityDate = toDateOnly(note.visible_from_date);
    const isHidden = Boolean(visibilityDate && today < visibilityDate);
    if (state.showHiddenNotes) return isHidden;
    return !isHidden;
  });
}

function toDateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(dateValue) {
  const date = new Date(dateValue);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateOnly(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return startOfDay(date);
}

function getNoteFlow(note) {
  const flow = Array.isArray(note?.note_flow) ? note.note_flow : [];
  if (flow.length) {
    return flow
      .map((entry) => normalizeFlowEntry(entry))
      .filter((entry) => entry.message || entry.attachments.length);
  }

  const legacyMessage = String(note?.note_text || '').trim();
  const legacyAttachments = Array.isArray(note?.attachments) ? note.attachments : [];
  if (!legacyMessage && !legacyAttachments.length) return [];
  return [
    buildFlowEntry({
      authorUid: note?.sender_uid || '',
      authorName: resolveProfileName(note?.sender_uid),
      message: legacyMessage,
      attachments: legacyAttachments,
      createdAt: note?.created_at || new Date().toISOString(),
      id: note?.id ? `${note.id}-legacy` : crypto.randomUUID(),
    }),
  ];
}

function buildFlowEntry({ authorUid, authorName, message, attachments, createdAt, id }) {
  return {
    id: id || crypto.randomUUID(),
    author_uid: String(authorUid || ''),
    author_name: String(authorName || resolveProfileName(authorUid) || NOTE_FLOW_FALLBACK_NAME),
    message: String(message || '').trim(),
    attachments: Array.isArray(attachments) ? attachments : [],
    created_at: String(createdAt || new Date().toISOString()),
  };
}

function normalizeFlowEntry(entry) {
  return buildFlowEntry({
    id: entry?.id,
    authorUid: entry?.author_uid,
    authorName: entry?.author_name,
    message: entry?.message,
    attachments: entry?.attachments,
    createdAt: entry?.created_at,
  });
}

function resolveProfileName(profileId) {
  if (!profileId) return '';
  const profile = state.profiles.find((item) => String(item.id) === String(profileId));
  return String(profile?.full_name || profile?.email || '');
}

function renderFlowList(flowEntries) {
  if (!elements.noteFlowList) return;
  if (!flowEntries.length) {
    elements.noteFlowList.innerHTML = '<p class="subtle-text">Noch keine Kommentare vorhanden.</p>';
    return;
  }

  elements.noteFlowList.innerHTML = flowEntries
    .map((entry) => {
      const createdLabel = formatFlowTimestamp(entry.created_at);
      const links = Array.isArray(entry.attachments) && entry.attachments.length
        ? `<div class="flow-entry-attachments"><strong>Anhänge:</strong> ${entry.attachments
          .map((attachment) => `<a href="${escapeAttribute(attachment.publicUrl || '#')}" target="_blank" rel="noopener">${escapeHtml(attachment.name || 'Anhang')}</a>`)
          .join(' · ')}</div>`
        : '';
      return `
        <article class="flow-entry">
          <div class="flow-entry-header">
            <span class="flow-entry-author">${escapeHtml(entry.author_name || NOTE_FLOW_FALLBACK_NAME)}</span>
            <span>${escapeHtml(createdLabel)}</span>
          </div>
          <p class="flow-entry-message">${escapeHtml(entry.message || '–')}</p>
          ${links}
        </article>
      `;
    })
    .join('');
}

function formatFlowTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Zeit unbekannt';
  return new Intl.DateTimeFormat('de-CH', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function snapToGrid(value) {
  return Math.round(Number(value || 0) / GRID_SIZE) * GRID_SIZE;
}

function clampPosition(position) {
  const canvas = elements.canvas;
  if (!canvas) return { x: position.x, y: position.y };
  if (canvas.clientWidth <= 0 || canvas.clientHeight <= 0) {
    return { x: Math.max(0, position.x), y: Math.max(0, position.y) };
  }
  const maxX = Math.max(0, canvas.clientWidth - NOTE_CARD_WIDTH);
  const maxY = Math.max(0, canvas.clientHeight - NOTE_CARD_HEIGHT);
  return {
    x: Math.max(0, Math.min(maxX, position.x)),
    y: Math.max(0, Math.min(maxY, position.y)),
  };
}

function handleWindowResize() {
  renderCanvas();
}

function switchView(view) {
  state.activeView = view === 'disco' ? 'disco' : 'dashboard';
  elements.dashboardNavButton?.classList.toggle('active', state.activeView === 'dashboard');
  elements.discoNavButton?.classList.toggle('active', state.activeView === 'disco');
  elements.notesDashboardArea?.classList.toggle('hidden', state.activeView !== 'dashboard');
  elements.discoArea?.classList.toggle('hidden', state.activeView !== 'disco');
  if (state.activeView === 'disco') {
    renderDiscoPlanner();
    return;
  }
  renderCanvas();
}

function getWeekStart(dateValue = new Date()) {
  const date = new Date(dateValue);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function getWeekDates(startDate) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function getIsoWeekNumber(dateValue) {
  const date = new Date(dateValue);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const firstThursday = new Date(date.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / 604800000);
}

function formatDateKey(dateValue) {
  if (typeof dateValue === 'string') {
    const trimmed = dateValue.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  }
  const date = startOfDay(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function shiftDiscoWeek(days) {
  if (!state.discoWeekStart) state.discoWeekStart = getWeekStart(new Date());
  state.discoWeekStart.setDate(state.discoWeekStart.getDate() + days);
  await loadMainDispoAssignmentsForCurrentWeek();
  renderDiscoPlanner();
}

function renderDiscoLayerOptions() {
  if (!elements.discoLayerProfileInput) return;
  const weekStart = getWeekStart(state.discoWeekStart || new Date());
  const weekKey = formatDateKey(weekStart);
  const selectedIds = state.discoLayers
    .filter((layer) => formatDateKey(layer.week_start_date || weekStart) === weekKey)
    .map((layer) => String(layer.profile_uid || ''));
  const available = state.profiles.filter((profile) => !selectedIds.includes(String(profile.id)));
  if (!available.length) {
    elements.discoLayerProfileInput.innerHTML = '<option value="">Keine weiteren Mitarbeiter verfügbar</option>';
    elements.discoLayerProfileInput.disabled = true;
    return;
  }
  elements.discoLayerProfileInput.disabled = false;
  elements.discoLayerProfileInput.innerHTML = available
    .map((profile) => `<option value="${escapeAttribute(profile.id)}">${escapeHtml(profile.full_name || profile.email || profile.id)}</option>`)
    .join('');
}

function openDiscoLayerModal() {
  renderDiscoLayerOptions();
  if (elements.discoLayerProfileInput?.disabled) return;
  elements.discoLayerModal?.classList.remove('hidden');
}

function closeDiscoLayerModal() {
  elements.discoLayerModal?.classList.add('hidden');
}

async function handleDiscoLayerSubmit(event) {
  event.preventDefault();
  const profileId = String(elements.discoLayerProfileInput?.value || '').trim();
  if (!profileId) return;
  const weekStart = getWeekStart(state.discoWeekStart || new Date());
  const weekKey = formatDateKey(weekStart);
  const alreadyExists = state.discoLayers.some((layer) => formatDateKey(layer.week_start_date || weekStart) === weekKey && String(layer.profile_uid || '') === profileId);
  if (alreadyExists) return;
  try {
    const nextSortOrder = state.discoLayers.length
      ? Math.max(...state.discoLayers.map((layer) => Number(layer.sort_order || 0))) + 1
      : 1;
    const { error } = await state.supabase.from(DISCO_LAYERS_TABLE).insert({
      project_id: state.projectId,
      week_start_date: weekKey,
      profile_uid: profileId,
      sort_order: nextSortOrder,
    });
    if (error) throw error;
    closeDiscoLayerModal();
    await loadData();
  } catch (error) {
    showAlert(`Layer konnte nicht gespeichert werden: ${error.message}`, true);
  }
}

async function loadMainDispoAssignmentsForCurrentWeek() {
  if (!state.supabase || !state.projectId) return;
  if (!state.discoWeekStart) state.discoWeekStart = getWeekStart(new Date());
  const weekStart = getWeekStart(state.discoWeekStart);
  const weekDates = getWeekDates(weekStart);
  const startKey = formatDateKey(weekDates[0]);
  const endKey = formatDateKey(weekDates[6]);
  try {
    const { data, error } = await state.supabase
      .from('daily_assignments')
      .select('profile_id, assignment_date')
      .eq('project_id', state.projectId)
      .gte('assignment_date', startKey)
      .lte('assignment_date', endKey);
    if (error && !String(error.message || '').includes('relation')) throw error;
    state.mainDispoByProfileDate = new Set((data || []).map((entry) => `${String(entry.profile_id || '')}:${formatDateKey(entry.assignment_date)}`));
  } catch (error) {
    state.mainDispoByProfileDate = new Set();
    showAlert(`Hauptdispo konnte nicht geladen werden: ${error.message}`, true);
  }
}

function getMainDispoStatusClass(profileId, dateKey) {
  const key = `${String(profileId || '')}:${formatDateKey(dateKey)}`;
  return state.mainDispoByProfileDate.has(key) ? 'disco-main-dispo-assigned' : 'disco-main-dispo-missing';
}

function renderDiscoPlanner() {
  if (!elements.discoTableHead || !elements.discoTableBody || !elements.discoWeekLabel) return;
  if (!state.discoWeekStart) state.discoWeekStart = getWeekStart(new Date());
  const weekStart = getWeekStart(state.discoWeekStart);
  const weekDates = getWeekDates(weekStart);
  const weekdayFormatter = new Intl.DateTimeFormat('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const weekNumber = getIsoWeekNumber(weekStart);
  elements.discoWeekLabel.textContent = `KW ${String(weekNumber).padStart(2, '0')}`;

  elements.discoTableHead.innerHTML = `
    <tr>
      <th>Layer / Aufgabenpool</th>
      ${weekDates.map((date) => `<th>${escapeHtml(weekdayFormatter.format(date))}</th>`).join('')}
    </tr>
  `;

  const openTasks = getOpenTaskNotes();
  const placedNoteIds = new Set(state.discoEntries.map((entry) => String(entry.note_id)));
  const backlogTasks = openTasks.filter((note) => !placedNoteIds.has(String(note.id)));
  const entriesByKey = groupDiscoEntriesByCell();
  const weekStartKey = formatDateKey(weekStart);
  const layersForWeek = state.discoLayers.filter((layer) => formatDateKey(layer.week_start_date || weekStart) === weekStartKey);
  renderDiscoBacklogTasks(backlogTasks);

  const layerRows = layersForWeek.map((layer) => {
    const profileId = String(layer.profile_uid || '');
    const name = resolveProfileName(profileId) || profileId;
    const cells = weekDates.map((date) => {
      const dateKey = formatDateKey(date);
      const key = `${layer.id}:${dateKey}`;
      const entries = entriesByKey.get(key) || [];
      const dispoStatusClass = getMainDispoStatusClass(profileId, dateKey);
      return `<td class="disco-drop-cell ${dispoStatusClass}" data-drop-zone="layer" data-layer-id="${escapeAttribute(layer.id)}" data-date="${escapeAttribute(dateKey)}">
        <div class="disco-card-list">
          ${entries.map((entry) => {
            const note = state.notes.find((item) => String(item.id) === String(entry.note_id));
            return note ? renderDiscoTaskCard(note) : '';
          }).join('')}
        </div>
      </td>`;
    }).join('');
    return `<tr><th><div class="disco-layer-header"><span>${escapeHtml(name)}</span><button class="button button-danger compact" type="button" data-action="remove-disco-layer" data-layer-id="${escapeAttribute(layer.id)}" title="Layer entfernen" aria-label="Layer entfernen">Layer entfernen</button></div></th>${cells}</tr>`;
  }).join('');

  elements.discoTableBody.innerHTML = layerRows || `<tr><td colspan="8" class="disco-empty">Noch kein Mitarbeiter-Layer hinzugefügt.</td></tr>`;
  bindDiscoDragAndDrop();
}

function renderDiscoBacklogTasks(tasks) {
  if (!elements.discoOpenTasksList) return;
  if (!tasks.length) {
    elements.discoOpenTasksList.innerHTML = '<p class="subtle-text">Keine offenen Aufgaben.</p>';
    return;
  }
  elements.discoOpenTasksList.innerHTML = tasks.map((note) => renderDiscoTaskCard(note)).join('');
}

function getOpenTaskNotes() {
  return state.notes.filter((note) => {
    if (normalizeCategory(note.note_category) !== NOTE_CATEGORY_TASK) return false;
    return true;
  });
}

function groupDiscoEntriesByCell() {
  const grouped = new Map();
  for (const entry of state.discoEntries) {
    const layerId = String(entry.layer_id || '');
    const dateKey = String(entry.plan_date || '');
    if (!layerId || !dateKey) continue;
    const key = `${layerId}:${dateKey}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(entry);
  }
  return grouped;
}

function renderDiscoTaskCard(note) {
  const flow = getNoteFlow(note);
  const latestEntry = flow[flow.length - 1] || null;
  const text = String(latestEntry?.message || note.note_text || 'Aufgabe');
  return `<article class="disco-task-card" draggable="true" data-note-id="${escapeAttribute(note.id)}">
    <strong>${escapeHtml(buildTitleFromText(text))}</strong>
  </article>`;
}

function bindDiscoDragAndDrop() {
  const dragContainers = [elements.discoOpenTasksList, elements.discoTableBody].filter(Boolean);
  dragContainers.forEach((container) => container.querySelectorAll('.disco-task-card').forEach((node) => {
    node.addEventListener('click', () => {
      const noteId = String(node.dataset.noteId || '').trim();
      if (!noteId) return;
      openModalForNote(noteId);
    });
    node.addEventListener('dragstart', handleDiscoDragStart);
    node.addEventListener('dragend', () => {
      state.discoDragNoteId = null;
    });
  }));
  const dropZones = [];
  if (elements.discoOpenTasksList?.dataset?.dropZone) {
    dropZones.push(elements.discoOpenTasksList);
  }
  dropZones.push(
    ...(elements.discoOpenTasksList?.querySelectorAll('[data-drop-zone]') || []),
    ...(elements.discoTableBody?.querySelectorAll('[data-drop-zone]') || []),
  );
  dropZones.forEach((zone) => {
    zone.addEventListener('dragover', (event) => event.preventDefault());
    zone.addEventListener('drop', handleDiscoDrop);
  });
}

function handleDiscoDragStart(event) {
  const noteId = String(event.currentTarget?.dataset?.noteId || '').trim();
  if (!noteId) return;
  state.discoDragNoteId = noteId;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', noteId);
  }
}

async function handleDiscoDrop(event) {
  event.preventDefault();
  const noteId = String(state.discoDragNoteId || event.dataTransfer?.getData('text/plain') || '').trim();
  if (!noteId) return;
  const zone = event.currentTarget;
  const dropType = String(zone?.dataset?.dropZone || '');
  if (dropType === 'layer') {
    await assignTaskToLayer(noteId, String(zone.dataset.layerId || ''), String(zone.dataset.date || ''));
  } else {
    await moveTaskToBacklog(noteId);
  }
}

async function handleDiscoTableClick(event) {
  const removeLayerButton = event.target.closest('button[data-action="remove-disco-layer"]');
  if (removeLayerButton) {
    const layerId = String(removeLayerButton.dataset.layerId || '').trim();
    if (!layerId) return;
    await removeDiscoLayer(layerId);
    return;
  }
}

async function removeDiscoLayer(layerId) {
  const layer = state.discoLayers.find((item) => String(item.id) === String(layerId));
  if (!layer) return;
  const profileId = String(layer.profile_uid || '');
  const layerName = resolveProfileName(profileId) || profileId || 'diesen Layer';
  const shouldDelete = window.confirm(`Möchtest du ${layerName} wirklich aus dieser Woche entfernen? Zugeordnete Aufgaben landen wieder im Pool.`);
  if (!shouldDelete) return;

  const layerEntries = state.discoEntries.filter((entry) => String(entry.layer_id) === String(layerId));
  const noteIdsFromLayer = [...new Set(layerEntries.map((entry) => String(entry.note_id || '')).filter(Boolean))];
  const remainingPlannedNoteIds = new Set(
    state.discoEntries
      .filter((entry) => String(entry.layer_id) !== String(layerId))
      .map((entry) => String(entry.note_id || ''))
      .filter(Boolean),
  );
  const noteIdsToReset = noteIdsFromLayer.filter((noteId) => !remainingPlannedNoteIds.has(noteId));

  try {
    const { error: deleteError } = await state.supabase
      .from(DISCO_LAYERS_TABLE)
      .delete()
      .eq('id', layerId)
      .eq('project_id', state.projectId);
    if (deleteError) throw deleteError;

    if (noteIdsToReset.length) {
      const { error: noteError } = await state.supabase
        .from(NOTES_TABLE)
        .update({
          recipient_uid: null,
          visible_from_date: null,
        })
        .in('id', noteIdsToReset)
        .eq('target_uid', state.projectId)
        .eq('note_type', PROJECT_NOTE_TYPE);
      if (noteError) throw noteError;
    }

    await loadData();
  } catch (error) {
    showAlert(`Layer konnte nicht entfernt werden: ${error.message}`, true);
  }
}

async function assignTaskToLayer(noteId, layerId, dateKey) {
  if (!layerId || !dateKey) return;
  const layer = state.discoLayers.find((item) => String(item.id) === String(layerId));
  if (!layer) return;
  const recipientUid = String(layer.profile_uid || '').trim() || null;
  const previousEntries = state.discoEntries.filter((entry) => String(entry.note_id) === String(noteId));
  const deleteIds = previousEntries.map((entry) => entry.id).filter(Boolean);
  try {
    if (deleteIds.length) {
      const { error: deleteError } = await state.supabase.from(DISCO_ENTRIES_TABLE).delete().in('id', deleteIds);
      if (deleteError) throw deleteError;
    }
    const nextSortOrder = state.discoEntries.length
      ? Math.max(...state.discoEntries.map((entry) => Number(entry.sort_order || 0))) + 1
      : 1;
    const { error: insertError } = await state.supabase.from(DISCO_ENTRIES_TABLE).insert({
      project_id: state.projectId,
      note_id: noteId,
      layer_id: layerId,
      plan_date: dateKey,
      sort_order: nextSortOrder,
    });
    if (insertError) throw insertError;
    const { error: noteError } = await state.supabase.from(NOTES_TABLE).update({
      recipient_uid: recipientUid,
      visible_from_date: dateKey,
    }).eq('id', noteId);
    if (noteError) throw noteError;
    await loadData();
  } catch (error) {
    showAlert(`Aufgabe konnte nicht disponiert werden: ${error.message}`, true);
  }
}

async function moveTaskToBacklog(noteId) {
  try {
    const { error: deleteError } = await state.supabase.from(DISCO_ENTRIES_TABLE).delete().eq('note_id', noteId).eq('project_id', state.projectId);
    if (deleteError) throw deleteError;
    const { error: noteError } = await state.supabase.from(NOTES_TABLE).update({
      recipient_uid: null,
      visible_from_date: null,
    }).eq('id', noteId);
    if (noteError) throw noteError;
    await loadData();
  } catch (error) {
    showAlert(`Aufgabe konnte nicht in den Pool verschoben werden: ${error.message}`, true);
  }
}

function sanitizeFileName(name) {
  return String(name || 'attachment.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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
