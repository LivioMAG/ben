const CONFIG_PATH = './supabase-config.json';
const KANBAN_TABLE = 'project_kanban_notes';
const PROJECTS_TABLE = 'projects';
const KANBAN_COLUMNS = [
  { key: 'todo', label: 'To-Do' },
  { key: 'planned', label: 'Geplant' },
  { key: 'in_progress', label: 'In Bearbeitung' },
  { key: 'review', label: 'AI' },
  { key: 'done', label: 'Erledigt' },
];

const state = {
  supabase: null,
  projectId: '',
  project: null,
  notes: [],
  draggedNoteId: null,
  activeColumnKey: null,
};

const elements = {};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  cacheElements();
  bindEvents();

  const params = new URLSearchParams(window.location.search);
  state.projectId = String(params.get('projectId') || '').trim();
  if (!state.projectId) {
    showAlert('Projekt-ID fehlt.', true);
    return;
  }

  try {
    await initializeSupabase();
    await loadData();
  } catch (error) {
    showAlert(`Fehler beim Laden: ${error.message}`, true);
  }
}

function cacheElements() {
  elements.backButton = document.getElementById('backIconButton');
  elements.projectTitle = document.getElementById('projectTitle');
  elements.projectMeta = document.getElementById('projectMeta');
  elements.projectBudget = document.getElementById('projectBudget');
  elements.kanbanBoard = document.getElementById('kanbanBoard');
  elements.alert = document.getElementById('alert');

  elements.modal = document.getElementById('notesModal');
  elements.modalBackdrop = document.getElementById('notesModalBackdrop');
  elements.modalHeader = document.getElementById('notesModalHeader');
  elements.modalTitle = document.getElementById('notesModalTitle');
  elements.modalNotesList = document.getElementById('modalNotesList');
  elements.closeModalButton = document.getElementById('closeModalButton');
  elements.addNoteButton = document.getElementById('addNoteButton');

  elements.createNoteForm = document.getElementById('createNoteForm');
  elements.newNoteType = document.getElementById('newNoteType');
  elements.newNoteTitle = document.getElementById('newNoteTitle');
  elements.newNoteText = document.getElementById('newNoteText');
  elements.newTodoItem = document.getElementById('newTodoItem');
  elements.newCounterDescription = document.getElementById('newCounterDescription');
  elements.newCounterStart = document.getElementById('newCounterStart');
}

function bindEvents() {
  elements.backButton?.addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = './index.html';
  });

  elements.kanbanBoard?.addEventListener('click', handleBoardClick);
  elements.kanbanBoard?.addEventListener('dragstart', handleDragStart);
  elements.kanbanBoard?.addEventListener('dragover', handleDragOver);
  elements.kanbanBoard?.addEventListener('drop', handleDrop);

  elements.closeModalButton?.addEventListener('click', closeModal);
  elements.modalBackdrop?.addEventListener('click', closeModal);
  elements.addNoteButton?.addEventListener('click', openCreateNoteForm);
  elements.newNoteType?.addEventListener('change', updateCreateTypeFields);
  elements.createNoteForm?.addEventListener('submit', handleCreateNote);
  elements.modalNotesList?.addEventListener('click', handleModalClick);
  elements.modalNotesList?.addEventListener('change', handleModalChange);
}

async function initializeSupabase() {
  const config = await fetch(CONFIG_PATH, { cache: 'no-store' }).then((res) => res.json());
  state.supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
}

async function loadData() {
  const [projectResult, notesResult] = await Promise.all([
    state.supabase.from(PROJECTS_TABLE).select('*').eq('id', state.projectId).single(),
    state.supabase.from(KANBAN_TABLE).select('*').eq('project_id', state.projectId).order('position', { ascending: true }),
  ]);

  if (projectResult.error) throw projectResult.error;
  if (notesResult.error) throw notesResult.error;

  state.project = projectResult.data;
  state.notes = notesResult.data || [];
  render();
}

function render() {
  elements.projectTitle.textContent = state.project?.name || 'Auftrag';
  const commission = state.project?.commission_number ? `Kommission ${state.project.commission_number}` : '';
  elements.projectMeta.textContent = commission;
  const budget = Number(state.project?.budget || 0);
  elements.projectBudget.textContent = `Budget: ${budget > 0 ? formatCurrency(budget) : '–'}`;
  renderBoard();
  if (state.activeColumnKey) {
    renderModalNotes();
  }
}

function renderBoard() {
  if (!elements.kanbanBoard) return;

  elements.kanbanBoard.innerHTML = KANBAN_COLUMNS.map((column) => {
    const notes = getNotesByColumn(column.key);
    return `
      <section class="kanban-column" data-column="${escapeAttribute(column.key)}">
        <header>
          <span>${escapeHtml(column.label)}</span>
          <span class="count">${notes.length}</span>
        </header>
        <div class="kanban-dropzone" data-column="${escapeAttribute(column.key)}">
          ${notes.length ? notes.map((note) => renderPreviewCard(note)).join('') : '<p class="column-empty">Keine Notizen</p>'}
        </div>
      </section>
    `;
  }).join('');
}

function renderPreviewCard(note) {
  const noteType = getNoteType(note);
  const title = String(note.title || '').trim();
  const previewText = getPreviewText(note, noteType);
  const progress = getPreviewProgress(note, noteType);
  const titleMarkup = title ? `<h3 class="note-preview-title">${escapeHtml(title)}</h3>` : '';
  const progressMarkup = progress ? `
    <div class="preview-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${escapeAttribute(progress.percent)}">
      <div class="preview-progress-fill" style="width:${escapeAttribute(progress.percent)}%;"></div>
    </div>
    <p class="note-preview-meta">${escapeHtml(progress.label)}</p>
  ` : '';
  return `
    <article class="note-preview" draggable="true" data-note-id="${escapeAttribute(note.id)}" data-column="${escapeAttribute(note.status)}">
      ${titleMarkup}
      <p class="note-preview-text">${escapeHtml(previewText)}</p>
      ${progressMarkup}
    </article>
  `;
}

function getPreviewText(note, noteType) {
  if (noteType === 'todo') {
    return String(note.title || '').trim() || 'To-do-Notiz';
  }
  if (noteType === 'counter') {
    const description = String(note.counter_description || '').trim();
    if (description) return truncateText(description, 100);
    return String(note.title || '').trim() || 'Counter-Notiz';
  }
  return truncateText(String(note.content || '').trim(), 100) || 'Kein Inhalt';
}

function getPreviewProgress(note, noteType) {
  if (noteType === 'todo') {
    const items = normalizeTodoItems(note.todo_items);
    if (!items.length) return { percent: 0, label: '0/0 erledigt' };
    const done = items.filter((item) => item.done).length;
    const percent = Math.round((done / items.length) * 100);
    return { percent, label: `${done}/${items.length} erledigt` };
  }
  if (noteType === 'counter') {
    const start = Math.max(0, Number(note.counter_start_value ?? 0));
    const current = Math.max(0, Number(note.counter_value ?? 0));
    const completed = start > 0 ? Math.min(start, Math.max(0, start - current)) : 0;
    const percent = start > 0 ? Math.round((completed / start) * 100) : 0;
    return { percent, label: `${current} offen` };
  }
  return null;
}

function handleBoardClick(event) {
  const preview = event.target.closest('.note-preview');
  if (preview) {
    const columnKey = String(preview.dataset.column || '').trim();
    if (!columnKey) return;
    openModal(columnKey, String(preview.dataset.noteId || '').trim());
    return;
  }

  const column = event.target.closest('.kanban-column');
  if (!column) return;
  const columnKey = String(column.dataset.column || '').trim();
  if (!columnKey) return;
  openModal(columnKey);
}

function openModal(columnKey, focusNoteId = '') {
  const columnMeta = getColumnMeta(columnKey);
  state.activeColumnKey = columnKey;
  elements.modalTitle.textContent = `${columnMeta.label} – Notizen`;
  elements.createNoteForm.classList.add('hidden');
  elements.createNoteForm.reset();
  updateCreateTypeFields();
  elements.modal.classList.remove('hidden');
  renderModalNotes();
  if (focusNoteId) {
    requestAnimationFrame(() => {
      const target = elements.modalNotesList?.querySelector(`[data-note-id="${focusNoteId}"]`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
}

function closeModal() {
  state.activeColumnKey = null;
  elements.modal.classList.add('hidden');
}

function renderModalNotes() {
  if (!state.activeColumnKey || !elements.modalNotesList) return;
  const notes = getNotesByColumn(state.activeColumnKey);

  if (!notes.length) {
    elements.modalNotesList.innerHTML = '<p class="modal-empty">Noch keine Notizen in dieser Kategorie.</p>';
    return;
  }

  elements.modalNotesList.innerHTML = notes.map((note) => renderModalNoteCard(note)).join('');
}

function renderModalNoteCard(note) {
  const noteType = getNoteType(note);
  if (noteType === 'todo') return renderTodoCard(note);
  if (noteType === 'counter') return renderCounterCard(note);
  return renderTextCard(note);
}

function renderTextCard(note) {
  return `
    <article class="note-card note-type-text" data-note-id="${escapeAttribute(note.id)}">
      <header class="note-card-header">
        <span class="type-badge">Text</span>
        <div class="note-card-actions">
          <button type="button" class="button-secondary" data-action="save-text" data-note-id="${escapeAttribute(note.id)}">Speichern</button>
          <button type="button" class="button-danger" data-action="delete" data-note-id="${escapeAttribute(note.id)}">Löschen</button>
        </div>
      </header>
      <label>Titel (optional)
        <input type="text" data-field="title" data-note-id="${escapeAttribute(note.id)}" value="${escapeAttribute(note.title || '')}" />
      </label>
      <label>Inhalt
        <textarea rows="5" data-field="content" data-note-id="${escapeAttribute(note.id)}">${escapeHtml(note.content || '')}</textarea>
      </label>
    </article>
  `;
}

function renderTodoCard(note) {
  const items = normalizeTodoItems(note.todo_items);
  return `
    <article class="note-card note-type-todo" data-note-id="${escapeAttribute(note.id)}">
      <header class="note-card-header">
        <span class="type-badge">To-do</span>
        <div class="note-card-actions">
          <button type="button" class="button-secondary" data-action="save-title" data-note-id="${escapeAttribute(note.id)}">Speichern</button>
          <button type="button" class="button-danger" data-action="delete" data-note-id="${escapeAttribute(note.id)}">Löschen</button>
        </div>
      </header>
      <label>Titel (optional)
        <input type="text" data-field="title" data-note-id="${escapeAttribute(note.id)}" value="${escapeAttribute(note.title || '')}" />
      </label>
      <ul class="todo-list">
        ${items.map((item, index) => `
          <li class="todo-item ${item.done ? 'done' : ''}">
            <input type="checkbox" data-action="toggle-todo" data-note-id="${escapeAttribute(note.id)}" data-index="${index}" ${item.done ? 'checked' : ''} />
            <span>${escapeHtml(item.text || 'Untitled')}</span>
          </li>
        `).join('')}
      </ul>
      <div class="inline-row">
        <input type="text" maxlength="180" data-field="todo-input" data-note-id="${escapeAttribute(note.id)}" placeholder="To-do hinzufügen" />
        <button type="button" class="button-primary" data-action="add-todo" data-note-id="${escapeAttribute(note.id)}">+</button>
      </div>
    </article>
  `;
}

function renderCounterCard(note) {
  const value = Number(note.counter_value ?? note.counter_start_value ?? 0);
  const log = normalizeCounterLog(note.counter_log);
  return `
    <article class="note-card note-type-counter" data-note-id="${escapeAttribute(note.id)}">
      <header class="note-card-header">
        <span class="type-badge">Counter</span>
        <div class="note-card-actions">
          <button type="button" class="button-secondary" data-action="save-counter-meta" data-note-id="${escapeAttribute(note.id)}">Speichern</button>
          <button type="button" class="button-danger" data-action="delete" data-note-id="${escapeAttribute(note.id)}">Löschen</button>
        </div>
      </header>
      <label>Titel (optional)
        <input type="text" data-field="title" data-note-id="${escapeAttribute(note.id)}" value="${escapeAttribute(note.title || '')}" />
      </label>
      <label>Beschreibung (optional)
        <textarea rows="2" data-field="counter-description" data-note-id="${escapeAttribute(note.id)}">${escapeHtml(note.counter_description || '')}</textarea>
      </label>
      <div class="counter-value">${escapeHtml(String(value))}</div>
      <button type="button" class="button-secondary" data-action="open-counter-comment" data-note-id="${escapeAttribute(note.id)}">-1</button>
      <div class="counter-comment-box hidden" data-counter-box="${escapeAttribute(note.id)}">
        <label>Kommentar (Pflicht)
          <input type="text" maxlength="200" data-field="counter-comment" data-note-id="${escapeAttribute(note.id)}" placeholder="Grund für Reduktion" />
        </label>
        <button type="button" class="button-primary" data-action="confirm-counter-minus" data-note-id="${escapeAttribute(note.id)}">Bestätigen</button>
      </div>
      <ul class="counter-log">
        ${log.map((entry) => `<li>${escapeHtml(entry.timestamp)} – ${escapeHtml(entry.comment)}</li>`).join('') || '<li>Keine Einträge</li>'}
      </ul>
    </article>
  `;
}

async function handleCreateNote(event) {
  event.preventDefault();
  if (!state.activeColumnKey) return;

  const noteType = String(elements.newNoteType.value || 'text');
  const title = String(elements.newNoteTitle.value || '').trim();
  const basePayload = {
    project_id: state.projectId,
    status: state.activeColumnKey,
    position: getNotesByColumn(state.activeColumnKey).length,
    note_type: noteType,
    title,
    content: '',
    todo_items: [],
    counter_description: '',
    counter_start_value: 0,
    counter_value: 0,
    counter_log: [],
  };

  if (noteType === 'text') {
    const content = String(elements.newNoteText.value || '').trim();
    if (!content) {
      showAlert('Text-Notiz benötigt einen Inhalt.', true);
      return;
    }
    basePayload.content = content;
  }

  if (noteType === 'todo') {
    const firstTodo = String(elements.newTodoItem.value || '').trim();
    if (firstTodo) {
      basePayload.todo_items = [{ text: firstTodo, done: false }];
    }
  }

  if (noteType === 'counter') {
    const startValue = Number(elements.newCounterStart.value || 0);
    basePayload.counter_description = String(elements.newCounterDescription.value || '').trim();
    basePayload.counter_start_value = Number.isFinite(startValue) ? Math.round(startValue) : 0;
    basePayload.counter_value = basePayload.counter_start_value;
  }

  const { error } = await state.supabase.from(KANBAN_TABLE).insert(basePayload);
  if (error) {
    showAlert(`Notiz konnte nicht erstellt werden: ${error.message}`, true);
    return;
  }

  openCreateNoteForm();
  await loadData();
}

async function handleModalClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const noteId = String(button.dataset.noteId || '').trim();
  if (!noteId) return;

  if (button.dataset.action === 'delete') {
    const { error } = await state.supabase.from(KANBAN_TABLE).delete().eq('id', noteId);
    if (error) {
      showAlert(`Notiz konnte nicht gelöscht werden: ${error.message}`, true);
      return;
    }
    await loadData();
    return;
  }

  if (button.dataset.action === 'save-text') {
    await saveTextNote(noteId);
    return;
  }

  if (button.dataset.action === 'save-title') {
    await saveTitleOnly(noteId);
    return;
  }

  if (button.dataset.action === 'add-todo') {
    await addTodoItem(noteId);
    return;
  }

  if (button.dataset.action === 'save-counter-meta') {
    await saveCounterMeta(noteId);
    return;
  }

  if (button.dataset.action === 'open-counter-comment') {
    const box = elements.modalNotesList.querySelector(`[data-counter-box="${noteId}"]`);
    box?.classList.toggle('hidden');
    return;
  }

  if (button.dataset.action === 'confirm-counter-minus') {
    await decrementCounter(noteId);
  }
}

async function handleModalChange(event) {
  const action = String(event.target.dataset.action || '').trim();
  const noteId = String(event.target.dataset.noteId || '').trim();
  if (!noteId) return;

  if (action === 'toggle-todo') {
    const index = Number(event.target.dataset.index);
    const note = state.notes.find((entry) => String(entry.id) === noteId);
    if (!note) return;
    const items = normalizeTodoItems(note.todo_items);
    if (!items[index]) return;
    items[index].done = Boolean(event.target.checked);
    const { error } = await state.supabase.from(KANBAN_TABLE).update({ todo_items: items }).eq('id', noteId);
    if (error) {
      showAlert(`To-do konnte nicht aktualisiert werden: ${error.message}`, true);
      return;
    }
    await loadData();
  }
}

function updateCreateTypeFields() {
  const selected = String(elements.newNoteType?.value || 'text');
  document.querySelectorAll('[data-type-field]').forEach((element) => {
    const type = String(element.dataset.type || '');
    element.classList.toggle('hidden', type !== selected);
  });
}

function openCreateNoteForm() {
  if (!elements.createNoteForm) return;
  elements.createNoteForm.classList.remove('hidden');
  elements.createNoteForm.reset();
  if (elements.newNoteType) elements.newNoteType.value = 'text';
  updateCreateTypeFields();
  elements.newNoteTitle?.focus();
}

async function saveTextNote(noteId) {
  const titleInput = elements.modalNotesList.querySelector(`[data-field="title"][data-note-id="${noteId}"]`);
  const contentInput = elements.modalNotesList.querySelector(`[data-field="content"][data-note-id="${noteId}"]`);
  const payload = {
    title: String(titleInput?.value || '').trim(),
    content: String(contentInput?.value || '').trim(),
  };
  if (!payload.content) {
    showAlert('Text-Notiz darf nicht leer sein.', true);
    return;
  }
  const { error } = await state.supabase.from(KANBAN_TABLE).update(payload).eq('id', noteId);
  if (error) {
    showAlert(`Text-Notiz konnte nicht gespeichert werden: ${error.message}`, true);
    return;
  }
  showAlert('Text-Notiz gespeichert.');
  await loadData();
}

async function saveTitleOnly(noteId) {
  const titleInput = elements.modalNotesList.querySelector(`[data-field="title"][data-note-id="${noteId}"]`);
  const title = String(titleInput?.value || '').trim();
  const { error } = await state.supabase.from(KANBAN_TABLE).update({ title }).eq('id', noteId);
  if (error) {
    showAlert(`Titel konnte nicht gespeichert werden: ${error.message}`, true);
    return;
  }
  showAlert('Titel gespeichert.');
  await loadData();
}

async function addTodoItem(noteId) {
  const input = elements.modalNotesList.querySelector(`[data-field="todo-input"][data-note-id="${noteId}"]`);
  const text = String(input?.value || '').trim();
  if (!text) {
    showAlert('Bitte To-do Text eingeben.', true);
    return;
  }

  const note = state.notes.find((entry) => String(entry.id) === noteId);
  if (!note) return;
  const items = normalizeTodoItems(note.todo_items);
  items.push({ text, done: false });

  const { error } = await state.supabase.from(KANBAN_TABLE).update({ todo_items: items }).eq('id', noteId);
  if (error) {
    showAlert(`To-do konnte nicht hinzugefügt werden: ${error.message}`, true);
    return;
  }
  await loadData();
}

async function saveCounterMeta(noteId) {
  const titleInput = elements.modalNotesList.querySelector(`[data-field="title"][data-note-id="${noteId}"]`);
  const descriptionInput = elements.modalNotesList.querySelector(`[data-field="counter-description"][data-note-id="${noteId}"]`);
  const payload = {
    title: String(titleInput?.value || '').trim(),
    counter_description: String(descriptionInput?.value || '').trim(),
  };
  const { error } = await state.supabase.from(KANBAN_TABLE).update(payload).eq('id', noteId);
  if (error) {
    showAlert(`Counter-Metadaten konnten nicht gespeichert werden: ${error.message}`, true);
    return;
  }
  showAlert('Counter-Metadaten gespeichert.');
  await loadData();
}

async function decrementCounter(noteId) {
  const commentInput = elements.modalNotesList.querySelector(`[data-field="counter-comment"][data-note-id="${noteId}"]`);
  const comment = String(commentInput?.value || '').trim();
  if (!comment) {
    showAlert('Kommentar ist erforderlich.', true);
    return;
  }

  const note = state.notes.find((entry) => String(entry.id) === noteId);
  if (!note) return;

  const nextValue = Number(note.counter_value ?? 0) - 1;
  const nextLog = normalizeCounterLog(note.counter_log);
  nextLog.unshift({
    timestamp: new Date().toLocaleString('de-CH'),
    comment,
  });

  const { error } = await state.supabase.from(KANBAN_TABLE).update({
    counter_value: nextValue,
    counter_log: nextLog,
  }).eq('id', noteId);
  if (error) {
    showAlert(`Counter konnte nicht reduziert werden: ${error.message}`, true);
    return;
  }
  await loadData();
}

function handleDragStart(event) {
  const card = event.target.closest('.note-preview');
  if (!card) return;
  state.draggedNoteId = String(card.dataset.noteId || '');
  card.classList.add('dragging');
}

function handleDragOver(event) {
  const zone = event.target.closest('.kanban-dropzone');
  if (!zone) return;
  event.preventDefault();
}

async function handleDrop(event) {
  const zone = event.target.closest('.kanban-dropzone');
  if (!zone || !state.draggedNoteId) return;
  event.preventDefault();

  const newStatus = String(zone.dataset.column || '').trim();
  const note = state.notes.find((entry) => String(entry.id) === state.draggedNoteId);
  if (!note || !newStatus) return;

  const newPosition = getNotesByColumn(newStatus).length;
  const { error } = await state.supabase.from(KANBAN_TABLE).update({ status: newStatus, position: newPosition }).eq('id', note.id);

  document.querySelector('.note-preview.dragging')?.classList.remove('dragging');
  state.draggedNoteId = null;

  if (error) {
    showAlert(`Verschieben fehlgeschlagen: ${error.message}`, true);
    return;
  }
  await loadData();
}

function getNotesByColumn(columnKey) {
  return state.notes
    .filter((entry) => String(entry.status) === columnKey)
    .sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
}

function getNoteType(note) {
  const type = String(note.note_type || '').trim();
  if (type === 'todo' || type === 'counter' || type === 'text') return type;
  return 'text';
}

function getColumnMeta(columnKey) {
  return KANBAN_COLUMNS.find((column) => column.key === columnKey) || KANBAN_COLUMNS[0];
}

function normalizeTodoItems(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({ text: String(item?.text || '').trim(), done: Boolean(item?.done) }))
    .filter((item) => item.text);
}

function normalizeCounterLog(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => ({ timestamp: String(entry?.timestamp || '').trim(), comment: String(entry?.comment || '').trim() }))
    .filter((entry) => entry.timestamp && entry.comment);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', minimumFractionDigits: 2 }).format(Number(value || 0));
}

function showAlert(message, isError = false) {
  if (!elements.alert) return;
  elements.alert.textContent = message;
  elements.alert.classList.remove('hidden', 'error', 'success');
  elements.alert.classList.add(isError ? 'error' : 'success');
  if (!isError) {
    setTimeout(() => elements.alert?.classList.add('hidden'), 1800);
  }
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

function truncateText(value, maxLength) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}
