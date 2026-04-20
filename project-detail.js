const CONFIG_PATH = './supabase-config.json';
const KANBAN_TABLE = 'project_kanban_notes';
const PROJECTS_TABLE = 'projects';
const ATTACHMENTS_BUCKET = 'project-kanban-attachments';
const DOCUMENT_ACCEPT = 'application/pdf,image/*,audio/*';
const KANBAN_COLUMNS = [
  { key: 'todo', label: 'To-dos' },
  { key: 'planned', label: 'Geplant' },
  { key: 'in_progress', label: 'In Bearbeitung' },
  { key: 'review', label: 'AI' },
  { key: 'done', label: 'Erledigt' },
];

const state = {
  supabase: null,
  user: null,
  projectId: '',
  project: null,
  notes: [],
  draggedNoteId: null,
  pendingCreateColumn: null,
  activeAttachmentNoteId: null,
  activeCounterHistoryNoteId: null,
  activeTodoHistoryNoteId: null,
  pendingFocus: null,
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
  elements.openDocumentsButton = document.getElementById('openDocumentsButton');
  elements.noteTypeModal = document.getElementById('noteTypeModal');
  elements.noteTypeModalBackdrop = document.getElementById('noteTypeModalBackdrop');
  elements.closeNoteTypeModalButton = document.getElementById('closeNoteTypeModalButton');
  elements.noteTypeOptions = document.getElementById('noteTypeOptions');
  elements.attachmentModal = document.getElementById('attachmentModal');
  elements.attachmentModalBackdrop = document.getElementById('attachmentModalBackdrop');
  elements.closeAttachmentModalButton = document.getElementById('closeAttachmentModalButton');
  elements.attachmentModalContent = document.getElementById('attachmentModalContent');

  elements.documentsModal = document.getElementById('documentsModal');
  elements.documentsModalBackdrop = document.getElementById('documentsModalBackdrop');
  elements.closeDocumentsModalButton = document.getElementById('closeDocumentsModalButton');
  elements.documentsOverviewList = document.getElementById('documentsOverviewList');
  elements.counterHistoryModal = document.getElementById('counterHistoryModal');
  elements.counterHistoryModalBackdrop = document.getElementById('counterHistoryModalBackdrop');
  elements.closeCounterHistoryModalButton = document.getElementById('closeCounterHistoryModalButton');
  elements.counterHistoryModalContent = document.getElementById('counterHistoryModalContent');
  elements.todoHistoryModal = document.getElementById('todoHistoryModal');
  elements.todoHistoryModalBackdrop = document.getElementById('todoHistoryModalBackdrop');
  elements.closeTodoHistoryModalButton = document.getElementById('closeTodoHistoryModalButton');
  elements.todoHistoryModalContent = document.getElementById('todoHistoryModalContent');
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

  elements.closeNoteTypeModalButton?.addEventListener('click', closeNoteTypeModal);
  elements.noteTypeModalBackdrop?.addEventListener('click', closeNoteTypeModal);
  elements.noteTypeOptions?.addEventListener('click', handleNoteTypeOptionClick);
  elements.kanbanBoard?.addEventListener('change', handleBoardChange);
  elements.kanbanBoard?.addEventListener('keydown', handleBoardKeydown);
  elements.closeAttachmentModalButton?.addEventListener('click', closeAttachmentModal);
  elements.attachmentModalBackdrop?.addEventListener('click', closeAttachmentModal);
  elements.attachmentModalContent?.addEventListener('click', handleAttachmentModalClick);
  elements.attachmentModalContent?.addEventListener('change', handleAttachmentModalChange);

  elements.openDocumentsButton?.addEventListener('click', openDocumentsModal);
  elements.closeDocumentsModalButton?.addEventListener('click', closeDocumentsModal);
  elements.documentsModalBackdrop?.addEventListener('click', closeDocumentsModal);
  elements.closeCounterHistoryModalButton?.addEventListener('click', closeCounterHistoryModal);
  elements.counterHistoryModalBackdrop?.addEventListener('click', closeCounterHistoryModal);
  elements.closeTodoHistoryModalButton?.addEventListener('click', closeTodoHistoryModal);
  elements.todoHistoryModalBackdrop?.addEventListener('click', closeTodoHistoryModal);
  elements.todoHistoryModalContent?.addEventListener('click', handleTodoHistoryModalClick);
}

async function initializeSupabase() {
  const config = await fetch(CONFIG_PATH, { cache: 'no-store' }).then((res) => res.json());
  state.supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  const { data: sessionData } = await state.supabase.auth.getSession();
  state.user = sessionData?.session?.user || null;
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
  if (!elements.noteTypeModal?.classList.contains('hidden')) renderNoteTypeOptions();
  if (!elements.attachmentModal?.classList.contains('hidden')) renderAttachmentModal();
  if (!elements.documentsModal?.classList.contains('hidden')) {
    renderDocumentsOverview();
  }
  if (!elements.counterHistoryModal?.classList.contains('hidden')) {
    renderCounterHistoryModal();
  }
  if (!elements.todoHistoryModal?.classList.contains('hidden')) {
    renderTodoHistoryModal();
  }
  restorePendingFocus();
}

function renderBoard() {
  if (!elements.kanbanBoard) return;

  elements.kanbanBoard.innerHTML = KANBAN_COLUMNS.map((column) => {
    const notes = getNotesByColumn(column.key);
    return `
      <section class="kanban-column" data-column="${escapeAttribute(column.key)}">
        <header>
          <span>${escapeHtml(column.label)}</span>
          <button type="button" class="column-add-button" data-action="add-note-column" data-column="${escapeAttribute(column.key)}" aria-label="Notiz hinzufügen">＋</button>
        </header>
        <div class="kanban-dropzone" data-column="${escapeAttribute(column.key)}">
          ${notes.length ? notes.map((note) => renderPreviewCard(note, column.key)).join('') : '<p class="column-empty">Keine Notizen</p>'}
        </div>
      </section>
    `;
  }).join('');
}

function renderPreviewCard(note, columnKey) {
  const noteType = getNoteType(note);
  const attachments = normalizeAttachments(note.attachments);
  const icon = getNoteTypeIcon(noteType);
  const typeOptions = ['text', 'todo', 'counter']
    .map((type) => `<option value="${escapeAttribute(type)}" ${type === noteType ? 'selected' : ''}>${escapeHtml(getTypeLabel(type))}</option>`)
    .join('');
  const todoMarkup = noteType === 'todo' ? renderTodoPreview(note) : '';
  const counterMarkup = noteType === 'counter' ? renderCounterPreview(note) : '';
  const textMarkup = noteType === 'text'
    ? `<textarea class="note-preview-text inline-note-text" data-field="content-inline" data-note-id="${escapeAttribute(note.id)}" rows="3" aria-label="Notiztext" placeholder="Notiz hier eingeben ...">${escapeHtml(note.content || '')}</textarea>`
    : '';
  const todoDescription = noteType === 'todo'
    ? `<input type="text" class="todo-description-input" data-field="todo-description-inline" data-note-id="${escapeAttribute(note.id)}" value="${escapeAttribute(note.todo_description || '')}" placeholder="To-do Beschreibung ..." />`
    : '';
  const counterDescription = noteType === 'counter'
    ? `<input type="text" class="counter-description-input" data-field="counter-description-inline" data-note-id="${escapeAttribute(note.id)}" value="${escapeAttribute(note.counter_description || '')}" placeholder="Counter Beschreibung ..." />`
    : '';
  const metaUser = note.created_by_name || getCurrentUserName();
  const metaTime = formatTimestamp(note.updated_at || note.created_at);

  return `
    <article class="note-preview note-preview-${escapeAttribute(noteType)}" draggable="true" data-note-id="${escapeAttribute(note.id)}" data-column="${escapeAttribute(note.status)}">
      <div class="note-preview-topline">
        <div class="card-type-wrap">
          <span class="card-type-icon">${escapeHtml(icon)}</span>
          <select class="type-switch-inline" data-action="change-note-type" data-note-id="${escapeAttribute(note.id)}" aria-label="Notiztyp">${typeOptions}</select>
        </div>
        <div class="card-actions-inline">
          ${noteType === 'todo' ? `<button type="button" class="icon-plain" data-action="open-todo-history" data-note-id="${escapeAttribute(note.id)}" aria-label="To-do-History">🕘</button>` : ''}
          ${noteType === 'counter' ? `<button type="button" class="icon-plain" data-action="open-counter-history" data-note-id="${escapeAttribute(note.id)}" aria-label="Counter-History">🕘</button>` : ''}
          <button type="button" class="icon-plain" data-action="open-attachments" data-note-id="${escapeAttribute(note.id)}" aria-label="Anhänge">📎${attachments.length ? ` <span class="badge-count">${attachments.length}</span>` : ''}</button>
          <button type="button" class="icon-plain" data-action="delete-note" data-note-id="${escapeAttribute(note.id)}" aria-label="Löschen">🗑️</button>
        </div>
      </div>
      <div class="card-content-scroll">
        ${textMarkup}
        ${todoDescription}
        ${counterDescription}
        ${todoMarkup}
        ${counterMarkup}
      </div>
      <footer class="card-footer">
        <span>👤 ${escapeHtml(metaUser)}</span>
        <span>🕒 ${escapeHtml(metaTime)}</span>
      </footer>
    </article>
  `;
}

function getPreviewText(note, noteType, max = 120) {
  if (noteType === 'todo') {
    return truncateText(String(note.todo_description || '').trim(), max) || 'To-do-Liste';
  }
  if (noteType === 'counter') {
    const description = String(note.counter_description || '').trim();
    return truncateText(description, max) || 'Counter-Notiz';
  }
  return truncateText(String(note.content || '').trim(), max) || 'Leere Notiz';
}

function getPreviewProgress(note, noteType) {
  if (noteType === 'todo') {
    const items = normalizeTodoItems(note.todo_items);
    const done = items.filter((item) => item.done).length;
    const total = items.length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    return { percent, label: `${done}/${total} erledigt` };
  }
  if (noteType === 'counter') {
    const target = Math.max(1, Number(note.counter_start_value ?? 1));
    const current = Math.max(0, Number(note.counter_value ?? 0));
    const percent = Math.min(100, Math.round((current / target) * 100));
    return { percent, label: `${current}/${target} Bestätigungen` };
  }
  return null;
}

function handleBoardClick(event) {
  const addColumn = event.target.closest('[data-action="add-note-column"]');
  if (addColumn) {
    openNoteTypeModal(String(addColumn.dataset.column || '').trim());
    return;
  }

  const actionButton = event.target.closest('[data-action]');
  const action = String(actionButton?.dataset.action || '').trim();
  const noteId = String(actionButton?.dataset.noteId || '').trim();
  if (action === 'delete-note' && noteId) {
    deleteNote(noteId);
    return;
  }
  if (action === 'open-attachments' && noteId) {
    openAttachmentModal(noteId);
    return;
  }
  if (action === 'open-todo-history' && noteId) {
    openTodoHistoryModal(noteId);
    return;
  }
  if (action === 'confirm-counter-plus' && noteId) {
    incrementCounter(noteId);
    return;
  }
  if (action === 'edit-counter-target' && noteId) {
    editCounterTarget(noteId);
    return;
  }
  if (action === 'open-counter-history' && noteId) {
    openCounterHistoryModal(noteId);
  }
}

function renderTodoPreview(note) {
  const items = normalizeTodoItems(note.todo_items);
  const activeItems = items.filter((item) => !item.done);
  const list = activeItems.length
    ? `
      <ul class="todo-list compact">
        ${activeItems.map((item) => {
          const originalIndex = items.indexOf(item);
          return `
          <li class="todo-item">
            <input type="checkbox" data-action="toggle-todo" data-note-id="${escapeAttribute(note.id)}" data-index="${originalIndex}" />
            <input
              type="text"
              class="todo-inline-text"
              maxlength="180"
              value="${escapeAttribute(item.text || 'Untitled')}"
              data-field="todo-item-inline"
              data-note-id="${escapeAttribute(note.id)}"
              data-index="${originalIndex}"
              aria-label="To-do Text"
            />
          </li>
        `;
        }).join('')}
      </ul>
    `
    : '<p class="note-preview-meta">Noch keine To-dos</p>';
  return `
    ${list}
    <input type="text" class="todo-inline-input" maxlength="180" data-field="todo-input" data-note-id="${escapeAttribute(note.id)}" placeholder="To-do hinzufügen und Enter drücken" />
  `;
}

function renderCounterPreview(note) {
  const target = Math.max(1, Number(note.counter_start_value ?? 1));
  const value = Math.max(0, Number(note.counter_value ?? 0));
  const percent = Math.min(100, Math.round((value / target) * 100));
  return `
    <div class="counter-main">${escapeHtml(String(value))} von <button type="button" class="counter-target-edit-trigger" data-action="edit-counter-target" data-note-id="${escapeAttribute(note.id)}" aria-label="Counter Ziel bearbeiten">${escapeHtml(String(target))}</button></div>
      <div class="preview-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, Math.round((value / target) * 100))}">
        <div class="preview-progress-fill" style="width:${percent}%;"></div>
      </div>
      <div class="counter-actions">
        <button type="button" class="button-primary counter-plus" data-action="confirm-counter-plus" data-note-id="${escapeAttribute(note.id)}">Bestätigen</button>
      </div>
  `;
}

function openNoteTypeModal(columnKey) {
  if (!columnKey) return;
  state.pendingCreateColumn = columnKey;
  elements.noteTypeModal?.classList.remove('hidden');
  renderNoteTypeOptions();
}

function closeNoteTypeModal() {
  state.pendingCreateColumn = null;
  elements.noteTypeModal?.classList.add('hidden');
}

function renderNoteTypeOptions() {
  if (!elements.noteTypeOptions) return;
  elements.noteTypeOptions.innerHTML = ['text', 'todo', 'counter'].map((type) => `
    <button type="button" class="note-type-option" data-action="create-note-type" data-type="${escapeAttribute(type)}">
      <span>${escapeHtml(getNoteTypeIcon(type))}</span>
      <strong>${escapeHtml(getTypeLabel(type))}</strong>
    </button>
  `).join('');
}

async function handleNoteTypeOptionClick(event) {
  const button = event.target.closest('[data-action="create-note-type"]');
  if (!button || !state.pendingCreateColumn) return;
  await createNote(state.pendingCreateColumn, String(button.dataset.type || 'text'));
  closeNoteTypeModal();
}

function openAttachmentModal(noteId) {
  if (!noteId) return;
  state.activeAttachmentNoteId = noteId;
  elements.attachmentModal?.classList.remove('hidden');
  renderAttachmentModal();
}

function closeAttachmentModal() {
  state.activeAttachmentNoteId = null;
  elements.attachmentModal?.classList.add('hidden');
}

function renderAttachmentModal() {
  if (!elements.attachmentModalContent) return;
  const note = state.notes.find((entry) => String(entry.id) === String(state.activeAttachmentNoteId));
  if (!note) {
    elements.attachmentModalContent.innerHTML = '<p class="modal-empty">Notiz nicht gefunden.</p>';
    return;
  }
  const attachments = normalizeAttachments(note.attachments);
  elements.attachmentModalContent.innerHTML = `
    <div class="attachments-header">
      <label class="upload-link">＋ Datei hinzufügen
        <input type="file" data-action="upload-attachment-modal" data-note-id="${escapeAttribute(note.id)}" accept="${escapeAttribute(DOCUMENT_ACCEPT)}" />
      </label>
    </div>
    <div class="attachments-grid">
      ${attachments.length ? attachments.map((attachment, index) => renderAttachmentCard(note, attachment, index)).join('') : '<p class="modal-empty">Keine Anhänge vorhanden.</p>'}
    </div>
  `;
}

function openCounterHistoryModal(noteId) {
  state.activeCounterHistoryNoteId = noteId;
  elements.counterHistoryModal?.classList.remove('hidden');
  renderCounterHistoryModal();
}

function closeCounterHistoryModal() {
  state.activeCounterHistoryNoteId = null;
  elements.counterHistoryModal?.classList.add('hidden');
}

function openTodoHistoryModal(noteId) {
  state.activeTodoHistoryNoteId = noteId;
  elements.todoHistoryModal?.classList.remove('hidden');
  renderTodoHistoryModal();
}

function closeTodoHistoryModal() {
  state.activeTodoHistoryNoteId = null;
  elements.todoHistoryModal?.classList.add('hidden');
}

function renderTodoHistoryModal() {
  if (!elements.todoHistoryModalContent) return;
  const note = state.notes.find((entry) => String(entry.id) === String(state.activeTodoHistoryNoteId));
  if (!note) {
    elements.todoHistoryModalContent.innerHTML = '<p class="modal-empty">To-do nicht gefunden.</p>';
    return;
  }
  const doneItems = normalizeTodoItems(note.todo_items).filter((item) => item.done);
  elements.todoHistoryModalContent.innerHTML = doneItems.length
    ? `
      <ul class="counter-history-list todo-history-list">
        ${doneItems.map((item, index) => `
          <li class="todo-history-main">
            <p>${escapeHtml(item.text || 'Unbenanntes To-do')}</p>
            <button type="button" class="button-secondary" data-action="restore-todo-item" data-note-id="${escapeAttribute(note.id)}" data-history-index="${index}">Aktivieren</button>
          </li>
          <li class="todo-item-meta">${escapeHtml(item.done_by_name || 'Unbekannt')} · ${escapeHtml(formatTimestamp(item.done_at))}</li>
        `).join('')}
      </ul>
    `
    : '<p class="modal-empty">Noch keine erledigten To-dos.</p>';
}

async function handleTodoHistoryModalClick(event) {
  const button = event.target.closest('[data-action="restore-todo-item"]');
  if (!button) return;
  const noteId = String(button.dataset.noteId || '').trim();
  const historyIndex = Number(button.dataset.historyIndex);
  if (!noteId || Number.isNaN(historyIndex)) return;
  await restoreTodoItem(noteId, historyIndex);
}

function renderCounterHistoryModal() {
  if (!elements.counterHistoryModalContent) return;
  const note = state.notes.find((entry) => String(entry.id) === String(state.activeCounterHistoryNoteId));
  if (!note) {
    elements.counterHistoryModalContent.innerHTML = '<p class="modal-empty">Counter nicht gefunden.</p>';
    return;
  }
  const rows = normalizeCounterLog(note.counter_log);
  elements.counterHistoryModalContent.innerHTML = rows.length
    ? `
      <ul class="counter-history-list">
        ${rows.map((entry) => `<li><strong>${escapeHtml(entry.actor_name || 'Unbekannt')}</strong><span>${escapeHtml(formatTimestamp(entry.timestamp))}</span></li>`).join('')}
      </ul>
    `
    : '<p class="modal-empty">Noch keine Bestätigungen.</p>';
}

function renderAttachmentCard(note, attachment, index) {
  const type = getAttachmentType(attachment);
  const url = getAttachmentUrl(attachment);
  const uploadedInfo = attachment.uploadedAt ? `${formatTimestamp(attachment.uploadedAt)} · ${attachment.uploadedByName || 'Unbekannt'}` : '';
  const deleteButton = `<button type="button" class="button-danger attachment-delete" data-action="delete-attachment" data-note-id="${escapeAttribute(note.id)}" data-index="${index}">Entfernen</button>`;

  if (type === 'image') {
    return `
      <article class="attachment-card image">
        <a href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">
          <img src="${escapeAttribute(url)}" alt="${escapeAttribute(attachment.name || 'Bild')}" loading="lazy" />
        </a>
        <div class="attachment-meta">
          <strong>${escapeHtml(attachment.name || 'Bild')}</strong>
          <span>${escapeHtml(uploadedInfo)}</span>
        </div>
        ${deleteButton}
      </article>
    `;
  }

  if (type === 'audio') {
    return `
      <article class="attachment-card audio">
        <div class="attachment-meta">
          <strong>🎙️ ${escapeHtml(attachment.name || 'Audio')}</strong>
          <span>${escapeHtml(uploadedInfo)}</span>
        </div>
        <audio controls preload="none" src="${escapeAttribute(url)}"></audio>
        <div class="attachment-actions-row">
          <a class="button-secondary" href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">Öffnen</a>
          ${deleteButton}
        </div>
      </article>
    `;
  }

  return `
    <article class="attachment-card pdf">
      <div class="attachment-meta">
        <strong>📄 ${escapeHtml(attachment.name || 'Dokument')}</strong>
        <span>${escapeHtml(uploadedInfo)}</span>
      </div>
      <div class="attachment-actions-row">
        <a class="button-secondary" href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">Öffnen</a>
        <a class="button-secondary" href="${escapeAttribute(url)}" download="${escapeAttribute(attachment.name || 'dokument.pdf')}">Download</a>
        ${deleteButton}
      </div>
    </article>
  `;
}

async function createNote(columnKey, noteType = 'text') {
  if (!columnKey) return;
  const basePayload = {
    project_id: state.projectId,
    status: columnKey,
    position: getNotesByColumn(columnKey).length,
    note_type: noteType,
    title: '',
    content: '',
    todo_description: '',
    todo_items: [],
    counter_description: '',
    counter_start_value: 1,
    counter_value: 0,
    counter_log: [],
    attachments: [],
  };

  if (noteType === 'text') {
    basePayload.content = '';
  }

  if (noteType === 'todo') {
    basePayload.todo_description = '';
    basePayload.todo_items = [];
  }

  if (noteType === 'counter') {
    basePayload.counter_description = '';
    basePayload.counter_start_value = 1;
    basePayload.counter_value = 0;
  }

  const { error } = await state.supabase.from(KANBAN_TABLE).insert(basePayload);
  if (error) {
    showAlert(`Notiz konnte nicht erstellt werden: ${error.message}`, true);
    return;
  }
  await loadData();
}

async function toggleTodoItem(noteId, index, isChecked) {
  const note = state.notes.find((entry) => String(entry.id) === noteId);
  if (!note) return;
  const items = normalizeTodoItems(note.todo_items);
  if (!items[index]) return;
  items[index].done = isChecked;
  items[index].done_by_uid = isChecked ? getCurrentUserUid() : null;
  items[index].done_by_name = isChecked ? getCurrentUserName() : null;
  items[index].done_at = isChecked ? new Date().toISOString() : null;
  const sortedItems = [
    ...items.filter((item) => !item.done),
    ...items.filter((item) => item.done),
  ];
  const { error } = await state.supabase.from(KANBAN_TABLE).update({ todo_items: sortedItems }).eq('id', noteId);
  if (error) {
    showAlert(`To-do konnte nicht aktualisiert werden: ${error.message}`, true);
    return;
  }
  await loadData();
}

async function handleBoardChange(event) {
  const action = String(event.target.dataset.action || '').trim();
  const field = String(event.target.dataset.field || '').trim();
  const noteId = String(event.target.dataset.noteId || '').trim();
  if (!noteId) return;
  if (action === 'change-note-type') {
    await changeNoteType(noteId, String(event.target.value || 'text'));
    return;
  }
  if (action === 'toggle-todo') {
    await toggleTodoItem(noteId, Number(event.target.dataset.index), Boolean(event.target.checked));
  }
  if (field === 'content-inline') {
    await saveTextNote(noteId, event.target.value);
  }
  if (field === 'todo-description-inline') {
    await saveTodoDescription(noteId, event.target.value);
  }
  if (field === 'counter-description-inline') {
    await saveCounterDescription(noteId, event.target.value);
  }
  if (field === 'counter-target-inline') {
    await saveCounterTarget(noteId, event.target.value);
  }
  if (field === 'todo-item-inline') {
    const index = Number(event.target.dataset.index);
    await saveTodoItemText(noteId, index, event.target.value);
  }
}

async function handleBoardKeydown(event) {
  if (event.key !== 'Enter') return;
  const todoEditInput = event.target.closest('[data-field="todo-item-inline"]');
  if (todoEditInput) {
    event.preventDefault();
    const noteId = String(todoEditInput.dataset.noteId || '').trim();
    state.pendingFocus = { selector: `[data-field="todo-input"][data-note-id="${noteId}"]` };
    render();
    return;
  }
  const input = event.target.closest('[data-field="todo-input"]');
  if (!input) return;
  event.preventDefault();
  await addTodoItem(String(input.dataset.noteId || '').trim(), input);
}


async function saveTextNote(noteId, directValue = null) {
  const contentInput = document.querySelector(`[data-field="content"][data-note-id="${noteId}"], [data-field="content-inline"][data-note-id="${noteId}"]`);
  const payload = {
    title: '',
    content: String((directValue ?? contentInput?.value) || '').trim(),
  };
  const { error } = await state.supabase.from(KANBAN_TABLE).update(payload).eq('id', noteId);
  if (error) {
    showAlert(`Notiz konnte nicht gespeichert werden: ${error.message}`, true);
    return;
  }
  showAlert('Notiz gespeichert.');
  await loadData();
}

async function saveTodoDescription(noteId, value) {
  const todo_description = String(value || '').trim();
  const { error } = await state.supabase.from(KANBAN_TABLE).update({ todo_description, title: '' }).eq('id', noteId);
  if (error) {
    showAlert(`Beschreibung konnte nicht gespeichert werden: ${error.message}`, true);
    return;
  }
  await loadData();
}

async function saveCounterDescription(noteId, value) {
  const counter_description = String(value || '').trim();
  const { error } = await state.supabase.from(KANBAN_TABLE).update({ counter_description, title: '' }).eq('id', noteId);
  if (error) {
    showAlert(`Counter konnte nicht gespeichert werden: ${error.message}`, true);
    return;
  }
  await loadData();
}

async function saveCounterTarget(noteId, value) {
  const counter_start_value = Math.max(1, Number.parseInt(String(value || '1'), 10) || 1);
  const { error } = await state.supabase.from(KANBAN_TABLE).update({ counter_start_value }).eq('id', noteId);
  if (error) {
    showAlert(`Counter-Ziel konnte nicht gespeichert werden: ${error.message}`, true);
    return;
  }
  await loadData();
}

async function editCounterTarget(noteId) {
  const note = state.notes.find((entry) => String(entry.id) === String(noteId));
  if (!note) return;
  const currentTarget = Math.max(1, Number(note.counter_start_value ?? 1));
  const raw = window.prompt('Neues Ziel eingeben', String(currentTarget));
  if (raw === null) return;
  await saveCounterTarget(noteId, raw);
}

async function changeNoteType(noteId, nextType) {
  const normalizedType = ['text', 'todo', 'counter'].includes(nextType) ? nextType : 'text';
  const note = state.notes.find((entry) => String(entry.id) === String(noteId));
  if (!note) return;
  const payload = { note_type: normalizedType };
  if (normalizedType === 'text') {
    payload.content = String(note.content || note.todo_description || note.counter_description || '').trim() || 'Neue Notiz';
  } else if (normalizedType === 'todo') {
    payload.todo_description = String(note.todo_description || note.content || note.counter_description || '').trim();
    payload.todo_items = normalizeTodoItems(note.todo_items).length ? normalizeTodoItems(note.todo_items) : [];
  } else {
    payload.counter_description = String(note.counter_description || note.content || note.todo_description || '').trim() || 'Neuer Counter';
    payload.counter_start_value = Math.max(1, Number(note.counter_start_value || 1));
    payload.counter_value = Math.max(0, Number(note.counter_value || 0));
    payload.counter_log = normalizeCounterLog(note.counter_log);
  }
  const { error } = await state.supabase.from(KANBAN_TABLE).update(payload).eq('id', noteId);
  if (error) {
    showAlert(`Typwechsel fehlgeschlagen: ${error.message}`, true);
    return;
  }
  await loadData();
}

async function addTodoItem(noteId, inputElement = null) {
  const input = inputElement || document.querySelector(`[data-field="todo-input"][data-note-id="${noteId}"]`);
  const text = String(input?.value || '').trim();
  if (!text) {
    return;
  }

  const note = state.notes.find((entry) => String(entry.id) === noteId);
  if (!note) return;
  const items = normalizeTodoItems(note.todo_items);
  items.push({ text, done: false, done_by_uid: null, done_by_name: null, done_at: null });

  const { error } = await state.supabase.from(KANBAN_TABLE).update({ todo_items: items }).eq('id', noteId);
  if (error) {
    showAlert(`To-do konnte nicht hinzugefügt werden: ${error.message}`, true);
    return;
  }
  state.pendingFocus = { selector: `[data-field="todo-input"][data-note-id="${noteId}"]` };
  if (input) input.value = '';
  await loadData();
}

async function saveTodoItemText(noteId, index, nextText) {
  const note = state.notes.find((entry) => String(entry.id) === noteId);
  if (!note) return;
  const items = normalizeTodoItems(note.todo_items);
  if (!items[index]) return;
  const text = String(nextText || '').trim();
  if (!text) return;
  items[index].text = text;
  const { error } = await state.supabase.from(KANBAN_TABLE).update({ todo_items: items }).eq('id', noteId);
  if (error) {
    showAlert(`To-do konnte nicht aktualisiert werden: ${error.message}`, true);
    return;
  }
  await loadData();
}

async function restoreTodoItem(noteId, historyIndex) {
  const note = state.notes.find((entry) => String(entry.id) === noteId);
  if (!note) return;
  const items = normalizeTodoItems(note.todo_items);
  const doneIndexes = items.map((item, idx) => ({ item, idx })).filter((entry) => entry.item.done);
  const selected = doneIndexes[historyIndex];
  if (!selected) return;
  items[selected.idx].done = false;
  items[selected.idx].done_by_uid = null;
  items[selected.idx].done_by_name = null;
  items[selected.idx].done_at = null;
  const sortedItems = [
    ...items.filter((item) => !item.done),
    ...items.filter((item) => item.done),
  ];
  const { error } = await state.supabase.from(KANBAN_TABLE).update({ todo_items: sortedItems }).eq('id', noteId);
  if (error) {
    showAlert(`To-do konnte nicht aktiviert werden: ${error.message}`, true);
    return;
  }
  await loadData();
}

async function incrementCounter(noteId) {
  const note = state.notes.find((entry) => String(entry.id) === noteId);
  if (!note) return;

  const nextValue = Math.max(0, Number(note.counter_value ?? 0)) + 1;
  const nextLog = normalizeCounterLog(note.counter_log);
  nextLog.unshift({
    timestamp: new Date().toISOString(),
    actor_uid: getCurrentUserUid(),
    actor_name: getCurrentUserName(),
  });

  const { error } = await state.supabase.from(KANBAN_TABLE).update({
    counter_value: nextValue,
    counter_log: nextLog,
  }).eq('id', noteId);
  if (error) {
    showAlert(`Counter konnte nicht bestätigt werden: ${error.message}`, true);
    return;
  }
  await loadData();
}

async function deleteNote(noteId) {
  const note = state.notes.find((entry) => String(entry.id) === noteId);
  if (note) {
    await deleteAttachmentFiles(normalizeAttachments(note.attachments));
  }

  const { error } = await state.supabase.from(KANBAN_TABLE).delete().eq('id', noteId);
  if (error) {
    showAlert(`Notiz konnte nicht gelöscht werden: ${error.message}`, true);
    return;
  }
  await loadData();
}

async function uploadAttachment(noteId, file) {
  const mimeType = String(file?.type || '').toLowerCase();
  if (!mimeType.startsWith('image/') && !mimeType.startsWith('audio/') && mimeType !== 'application/pdf') {
    showAlert('Nur PDF, Bild oder Audio ist erlaubt.', true);
    return;
  }

  const note = state.notes.find((entry) => String(entry.id) === noteId);
  if (!note) {
    showAlert('Notiz wurde nicht gefunden.', true);
    return;
  }

  const safeFileName = sanitizeFileName(file.name || 'dokument');
  const storagePath = `${state.projectId}/${noteId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeFileName}`;
  const { error: uploadError } = await state.supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(storagePath, file, { upsert: false, contentType: file.type || undefined });

  if (uploadError) {
    showAlert(`Upload fehlgeschlagen: ${uploadError.message}`, true);
    return;
  }

  const attachments = normalizeAttachments(note.attachments);
  attachments.unshift({
    name: file.name || 'Dokument',
    mimeType: mimeType || 'application/octet-stream',
    bucket: ATTACHMENTS_BUCKET,
    path: storagePath,
    uploadedAt: new Date().toISOString(),
    uploadedByUid: getCurrentUserUid(),
    uploadedByName: getCurrentUserName(),
    size: Number(file.size || 0),
  });

  const { error: updateError } = await state.supabase.from(KANBAN_TABLE).update({ attachments }).eq('id', noteId);
  if (updateError) {
    await state.supabase.storage.from(ATTACHMENTS_BUCKET).remove([storagePath]);
    showAlert(`Dokument konnte nicht gespeichert werden: ${updateError.message}`, true);
    return;
  }

  await loadData();
}

async function deleteAttachment(noteId, index) {
  const note = state.notes.find((entry) => String(entry.id) === noteId);
  if (!note) return;

  const attachments = normalizeAttachments(note.attachments);
  const [attachment] = attachments.splice(index, 1);
  if (!attachment) return;

  await deleteAttachmentFiles([attachment]);

  const { error } = await state.supabase.from(KANBAN_TABLE).update({ attachments }).eq('id', noteId);
  if (error) {
    showAlert(`Dokument konnte nicht entfernt werden: ${error.message}`, true);
    return;
  }

  await loadData();
}

async function handleAttachmentModalClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const action = String(button.dataset.action || '').trim();
  const noteId = String(button.dataset.noteId || '').trim();
  if (action === 'delete-attachment' && noteId) {
    const index = Number(button.dataset.index);
    if (Number.isInteger(index) && index >= 0) await deleteAttachment(noteId, index);
  }
}

async function handleAttachmentModalChange(event) {
  const action = String(event.target.dataset.action || '').trim();
  const noteId = String(event.target.dataset.noteId || '').trim();
  if (action !== 'upload-attachment-modal' || !noteId) return;
  const file = event.target.files?.[0];
  if (!file) return;
  await uploadAttachment(noteId, file);
  event.target.value = '';
}

async function deleteAttachmentFiles(attachments) {
  const byBucket = new Map();
  attachments.forEach((attachment) => {
    const bucket = String(attachment?.bucket || ATTACHMENTS_BUCKET).trim() || ATTACHMENTS_BUCKET;
    const path = String(attachment?.path || '').trim();
    if (!path) return;
    if (!byBucket.has(bucket)) byBucket.set(bucket, []);
    byBucket.get(bucket).push(path);
  });

  for (const [bucket, paths] of byBucket.entries()) {
    if (!paths.length) continue;
    const { error } = await state.supabase.storage.from(bucket).remove(paths);
    if (error) {
      showAlert(`Warnung: Dokumentdatei konnte nicht gelöscht werden (${error.message}).`, true);
    }
  }
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

function openDocumentsModal() {
  elements.documentsModal?.classList.remove('hidden');
  renderDocumentsOverview();
}

function closeDocumentsModal() {
  elements.documentsModal?.classList.add('hidden');
}

function renderDocumentsOverview() {
  if (!elements.documentsOverviewList) return;
  const allDocuments = getAllDocuments();

  if (!allDocuments.length) {
    elements.documentsOverviewList.innerHTML = '<p class="modal-empty">Noch keine Dokumente im Kanban-System vorhanden.</p>';
    return;
  }

  elements.documentsOverviewList.innerHTML = allDocuments.map((entry) => `
    <article class="documents-overview-card">
      <div class="documents-overview-main">
        <p class="documents-type">${escapeHtml(getAttachmentTypeLabel(entry.attachment))}</p>
        <strong>${escapeHtml(entry.attachment.name || 'Dokument')}</strong>
        <p class="note-preview-meta">${escapeHtml(entry.columnLabel)} · ${escapeHtml(getTypeLabel(getNoteType(entry.note)))} · ${escapeHtml(getPreviewText(entry.note, getNoteType(entry.note)))}</p>
        <p class="note-preview-meta">${escapeHtml(entry.attachment.uploadedByName || 'Unbekannt')} · ${escapeHtml(formatTimestamp(entry.attachment.uploadedAt))}</p>
      </div>
      <div class="attachment-actions-row">
        <a class="button-secondary" href="${escapeAttribute(getAttachmentUrl(entry.attachment))}" target="_blank" rel="noopener noreferrer">Öffnen</a>
      </div>
    </article>
  `).join('');
}

function getAllDocuments() {
  return state.notes.flatMap((note) => normalizeAttachments(note.attachments).map((attachment) => ({
    note,
    attachment,
    columnLabel: getColumnMeta(note.status).label,
  })));
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

function getTypeLabel(type) {
  if (type === 'todo') return 'To-do';
  if (type === 'counter') return 'Counter';
  return 'Notiz';
}

function getNoteTypeIcon(type) {
  if (type === 'todo') return '☑️';
  if (type === 'counter') return '🔢';
  return '📝';
}

function getColumnMeta(columnKey) {
  return KANBAN_COLUMNS.find((column) => column.key === columnKey) || KANBAN_COLUMNS[0];
}

function normalizeTodoItems(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      text: String(item?.text || '').trim(),
      done: Boolean(item?.done),
      done_by_uid: String(item?.done_by_uid || '').trim(),
      done_by_name: String(item?.done_by_name || '').trim(),
      done_at: String(item?.done_at || '').trim(),
    }))
    .filter((item) => item.text);
}

function normalizeCounterLog(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => ({
      timestamp: String(entry?.timestamp || '').trim(),
      actor_uid: String(entry?.actor_uid || '').trim(),
      actor_name: String(entry?.actor_name || '').trim(),
    }))
    .filter((entry) => entry.timestamp);
}

function normalizeAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((attachment) => ({
      name: String(attachment?.name || '').trim() || 'Dokument',
      mimeType: String(attachment?.mimeType || '').trim() || 'application/octet-stream',
      path: String(attachment?.path || '').trim(),
      bucket: String(attachment?.bucket || ATTACHMENTS_BUCKET).trim() || ATTACHMENTS_BUCKET,
      publicUrl: String(attachment?.publicUrl || '').trim(),
      uploadedAt: String(attachment?.uploadedAt || '').trim(),
      uploadedByUid: String(attachment?.uploadedByUid || '').trim(),
      uploadedByName: String(attachment?.uploadedByName || '').trim(),
      size: Number(attachment?.size || 0),
    }))
    .filter((attachment) => attachment.path || attachment.publicUrl);
}

function getAttachmentUrl(attachment) {
  if (attachment.publicUrl) return attachment.publicUrl;
  const bucket = String(attachment?.bucket || ATTACHMENTS_BUCKET).trim() || ATTACHMENTS_BUCKET;
  const path = String(attachment?.path || '').trim();
  if (!path) return '#';
  const { data } = state.supabase.storage.from(bucket).getPublicUrl(path);
  return String(data?.publicUrl || '').trim() || '#';
}

function getAttachmentType(attachment) {
  const mimeType = String(attachment?.mimeType || '').toLowerCase();
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'pdf';
}

function getAttachmentTypeLabel(attachment) {
  const type = getAttachmentType(attachment);
  if (type === 'image') return 'Bild';
  if (type === 'audio') return 'Audio';
  return 'PDF';
}

function getAttachmentVisual(attachment) {
  const type = getAttachmentType(attachment);
  if (type === 'image') return '🖼';
  if (type === 'audio') return '🎧';
  return '📄';
}

function buildActivityTimeline(note) {
  const createdAt = formatTimestamp(note.created_at);
  const rows = [{ user: note.created_by_name || 'System', when: createdAt, action: 'Notiz erstellt' }];
  if (getNoteType(note) === 'todo') {
    normalizeTodoItems(note.todo_items).forEach((item) => {
      if (item.done_at) {
        rows.unshift({
          user: item.done_by_name || item.done_by_uid || 'Unbekannt',
          when: formatTimestamp(item.done_at),
          action: `To-do erledigt: ${item.text}`,
        });
      }
    });
  }
  if (getNoteType(note) === 'counter') {
    normalizeCounterLog(note.counter_log).forEach((entry) => {
      rows.unshift({
        user: entry.actor_name || entry.actor_uid || 'Unbekannt',
        when: formatTimestamp(entry.timestamp),
        action: 'Counter +1 bestätigt',
      });
    });
  }
  return rows;
}

function getCurrentUserUid() {
  return String(state.user?.id || '').trim() || 'unbekannt';
}

function getCurrentUserName() {
  const fullName = String(state.user?.user_metadata?.full_name || '').trim();
  if (fullName) return fullName;
  const name = String(state.user?.user_metadata?.name || '').trim();
  if (name) return name;
  const emailName = String(state.user?.email || '').trim().split('@')[0];
  return emailName || 'Unbekannt';
}

function formatCurrency(value) {
  return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', minimumFractionDigits: 2 }).format(Number(value || 0));
}

function formatTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '–';
  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
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

function restorePendingFocus() {
  if (!state.pendingFocus?.selector) return;
  const target = document.querySelector(state.pendingFocus.selector);
  if (target) target.focus();
  state.pendingFocus = null;
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

function sanitizeFileName(value) {
  return String(value || 'dokument')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 140) || 'dokument';
}
