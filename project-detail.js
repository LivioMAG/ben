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
  activeNoteId: null,
  activeColumnKey: null,
  panelMode: 'note',
  panelTab: 'details',
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

  elements.notePanel = document.getElementById('notePanel');
  elements.notePanelBackdrop = document.getElementById('notePanelBackdrop');
  elements.closePanelButton = document.getElementById('closePanelButton');
  elements.panelTitle = document.getElementById('panelTitle');
  elements.panelTabs = Array.from(document.querySelectorAll('.slide-tab'));
  elements.panelContent = document.getElementById('panelContent');

  elements.createNoteForm = document.getElementById('createNoteForm');
  elements.newNoteType = document.getElementById('newNoteType');
  elements.newNoteText = document.getElementById('newNoteText');
  elements.newTodoDescription = document.getElementById('newTodoDescription');
  elements.newTodoItem = document.getElementById('newTodoItem');
  elements.newCounterDescription = document.getElementById('newCounterDescription');
  elements.newCounterStart = document.getElementById('newCounterStart');

  elements.documentsModal = document.getElementById('documentsModal');
  elements.documentsModalBackdrop = document.getElementById('documentsModalBackdrop');
  elements.closeDocumentsModalButton = document.getElementById('closeDocumentsModalButton');
  elements.documentsOverviewList = document.getElementById('documentsOverviewList');
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

  elements.closePanelButton?.addEventListener('click', closePanel);
  elements.notePanelBackdrop?.addEventListener('click', closePanel);
  elements.panelTabs.forEach((tab) => tab.addEventListener('click', () => switchPanelTab(tab.dataset.tab)));
  elements.newNoteType?.addEventListener('change', updateCreateTypeFields);
  elements.createNoteForm?.addEventListener('submit', handleCreateNote);
  elements.kanbanBoard?.addEventListener('change', handleBoardChange);
  elements.kanbanBoard?.addEventListener('keydown', handleBoardKeydown);
  elements.panelContent?.addEventListener('click', handlePanelClick);
  elements.panelContent?.addEventListener('change', handlePanelChange);

  elements.openDocumentsButton?.addEventListener('click', openDocumentsModal);
  elements.closeDocumentsModalButton?.addEventListener('click', closeDocumentsModal);
  elements.documentsModalBackdrop?.addEventListener('click', closeDocumentsModal);
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
  if (!elements.notePanel?.classList.contains('hidden')) {
    renderPanel();
  }
  if (!elements.documentsModal?.classList.contains('hidden')) {
    renderDocumentsOverview();
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
  const previewText = getPreviewText(note, noteType, 220);
  const progress = getPreviewProgress(note, noteType);
  const attachments = normalizeAttachments(note.attachments);
  const icon = getNoteTypeIcon(noteType);
  const todoMarkup = noteType === 'todo' ? renderTodoPreview(note) : '';
  const counterMarkup = noteType === 'counter' ? renderCounterPreview(note) : '';
  const docsMarkup = attachments.length ? `
    <div class="card-docs-strip">
      ${attachments.slice(0, 3).map((attachment) => `<span class="doc-mini">${escapeHtml(getAttachmentVisual(attachment))}</span>`).join('')}
      ${attachments.length > 3 ? `<span class="doc-mini">+${attachments.length - 3}</span>` : ''}
    </div>
  ` : '';
  const metaUser = getCurrentUserName();
  const metaTime = formatTimestamp(note.updated_at || note.created_at);

  return `
    <article class="note-preview note-preview-${escapeAttribute(noteType)}" draggable="true" data-note-id="${escapeAttribute(note.id)}" data-column="${escapeAttribute(note.status)}">
      <div class="note-preview-topline">
        <div class="card-type-wrap">
          <span class="card-type-icon">${escapeHtml(icon)}</span>
          <span class="type-badge">${escapeHtml(getTypeLabel(noteType))}</span>
        </div>
        <div class="card-actions-inline">
          <button type="button" class="icon-plain" data-action="edit-note" data-note-id="${escapeAttribute(note.id)}" aria-label="Bearbeiten">✏️</button>
          <label class="icon-plain attach-icon" aria-label="Dokument anhängen">📎
            <input type="file" data-action="upload-attachment" data-note-id="${escapeAttribute(note.id)}" accept="${escapeAttribute(DOCUMENT_ACCEPT)}" />
          </label>
          <button type="button" class="icon-plain" data-action="delete-note" data-note-id="${escapeAttribute(note.id)}" aria-label="Weitere Aktionen">⋯</button>
        </div>
      </div>
      <p class="note-preview-text">${escapeHtml(previewText)}</p>
      ${todoMarkup}
      ${counterMarkup}
      ${docsMarkup}
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
    openCreatePanel(String(addColumn.dataset.column || '').trim());
    return;
  }

  const actionButton = event.target.closest('[data-action]');
  const action = String(actionButton?.dataset.action || '').trim();
  const noteId = String(actionButton?.dataset.noteId || '').trim();
  if (action === 'edit-note' && noteId) {
    openNotePanel(noteId, 'details');
    return;
  }
  if (action === 'delete-note' && noteId) {
    deleteNote(noteId);
    return;
  }
  const preview = event.target.closest('.note-preview');
  if (preview && !action) {
    openNotePanel(String(preview.dataset.noteId || '').trim(), 'details');
  }
}
function openCreatePanel(columnKey) {
  if (!columnKey) return;
  state.activeColumnKey = columnKey;
  state.activeNoteId = null;
  state.panelMode = 'create';
  state.panelTab = 'details';
  elements.notePanel?.classList.remove('hidden');
  renderPanel();
}

function openNotePanel(noteId, tab = 'details') {
  if (!noteId) return;
  const note = state.notes.find((entry) => String(entry.id) === String(noteId));
  if (!note) return;
  state.activeNoteId = noteId;
  state.activeColumnKey = String(note.status || '').trim();
  state.panelMode = 'note';
  state.panelTab = tab;
  elements.notePanel?.classList.remove('hidden');
  renderPanel();
}

function closePanel() {
  state.activeColumnKey = null;
  state.activeNoteId = null;
  state.panelMode = 'note';
  state.panelTab = 'details';
  elements.notePanel?.classList.add('hidden');
}

function renderTodoPreview(note) {
  const items = normalizeTodoItems(note.todo_items);
  if (!items.length) return '<p class="note-preview-meta">Noch keine To-dos</p>';
  return `
    <ul class="todo-list compact">
      ${items.slice(0, 4).map((item, index) => `
        <li class="todo-item ${item.done ? 'done' : ''}">
          <input type="checkbox" data-action="toggle-todo" data-note-id="${escapeAttribute(note.id)}" data-index="${index}" ${item.done ? 'checked' : ''} />
          <span>${escapeHtml(item.text || 'Untitled')}</span>
        </li>
      `).join('')}
    </ul>
    <input type="text" class="todo-inline-input" maxlength="180" data-field="todo-input" data-note-id="${escapeAttribute(note.id)}" placeholder="To-do hinzufügen und Enter drücken" />
  `;
}

function renderCounterPreview(note) {
  const target = Math.max(1, Number(note.counter_start_value ?? 1));
  const value = Math.max(0, Number(note.counter_value ?? 0));
  const percent = Math.min(100, Math.round((value / target) * 100));
  return `
    <div class="counter-main">${escapeHtml(String(value))} / ${escapeHtml(String(target))}</div>
      <div class="preview-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, Math.round((value / target) * 100))}">
        <div class="preview-progress-fill" style="width:${percent}%;"></div>
      </div>
      <button type="button" class="button-primary counter-plus" data-action="confirm-counter-plus" data-note-id="${escapeAttribute(note.id)}">+1 bestätigen</button>
  `;
}

function renderPanel() {
  if (!elements.panelContent) return;
  const note = state.notes.find((entry) => String(entry.id) === String(state.activeNoteId));
  const isCreate = state.panelMode === 'create';
  elements.createNoteForm?.classList.toggle('hidden', !isCreate);
  elements.panelTabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === state.panelTab));
  elements.panelTitle.textContent = isCreate ? `Neue Notiz · ${getColumnMeta(state.activeColumnKey).label}` : `${getTypeLabel(getNoteType(note || {}))} · ${getColumnMeta(note?.status || '').label}`;

  if (isCreate) {
    elements.panelContent.innerHTML = '<p class="modal-empty">Notiztyp wählen, Inhalte erfassen und speichern.</p>';
    return;
  }
  if (!note) {
    elements.panelContent.innerHTML = '<p class="modal-empty">Notiz nicht gefunden.</p>';
    return;
  }

  if (state.panelTab === 'activity') {
    elements.panelContent.innerHTML = renderActivityTab(note);
    return;
  }
  if (state.panelTab === 'documents') {
    elements.panelContent.innerHTML = renderDocumentsTab(note);
    return;
  }
  elements.panelContent.innerHTML = renderDetailsTab(note);
}

function renderDetailsTab(note) {
  const type = getNoteType(note);
  if (type === 'todo') {
    return `
      <article class="note-card" data-note-id="${escapeAttribute(note.id)}">
        <label>Beschreibung
          <textarea rows="4" data-field="todo-description" data-note-id="${escapeAttribute(note.id)}">${escapeHtml(note.todo_description || '')}</textarea>
        </label>
        <button type="button" class="button-secondary" data-action="save-todo-meta" data-note-id="${escapeAttribute(note.id)}">Speichern</button>
      </article>
    `;
  }
  if (type === 'counter') {
    return `
      <article class="note-card" data-note-id="${escapeAttribute(note.id)}">
        <label>Beschreibung
          <textarea rows="4" data-field="counter-description" data-note-id="${escapeAttribute(note.id)}">${escapeHtml(note.counter_description || '')}</textarea>
        </label>
        <button type="button" class="button-secondary" data-action="save-counter-meta" data-note-id="${escapeAttribute(note.id)}">Speichern</button>
      </article>
    `;
  }
  return `
    <article class="note-card" data-note-id="${escapeAttribute(note.id)}">
      <label>Beschreibung
        <textarea rows="6" data-field="content" data-note-id="${escapeAttribute(note.id)}">${escapeHtml(note.content || '')}</textarea>
      </label>
      <button type="button" class="button-secondary" data-action="save-text" data-note-id="${escapeAttribute(note.id)}">Speichern</button>
    </article>
  `;
}

function renderActivityTab(note) {
  const rows = buildActivityTimeline(note);
  return rows.length
    ? `<ul class="activity-list">${rows.map((row) => `<li><strong>${escapeHtml(row.user)}</strong><span>${escapeHtml(row.when)}</span><p>${escapeHtml(row.action)}</p></li>`).join('')}</ul>`
    : '<p class="modal-empty">Noch keine Aktivitäten.</p>';
}

function renderDocumentsTab(note) {
  return renderAttachmentsSection(note);
}

function renderAttachmentsSection(note) {
  const attachments = normalizeAttachments(note.attachments);
  const noteId = escapeAttribute(note.id);
  return `
    <section class="attachments-section">
      <header class="attachments-header">
        <h4>Dokumente</h4>
        <label class="button-secondary upload-button">
          Anhängen
          <input type="file" data-action="upload-attachment" data-note-id="${noteId}" accept="${escapeAttribute(DOCUMENT_ACCEPT)}" />
        </label>
      </header>
      <div class="attachments-grid">
        ${attachments.length ? attachments.map((attachment, index) => renderAttachmentCard(note, attachment, index)).join('') : '<p class="note-preview-meta">Keine Dokumente vorhanden.</p>'}
      </div>
    </section>
  `;
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

async function handleCreateNote(event) {
  event.preventDefault();
  if (!state.activeColumnKey) return;

  const noteType = String(elements.newNoteType.value || 'text');
  const basePayload = {
    project_id: state.projectId,
    status: state.activeColumnKey,
    position: getNotesByColumn(state.activeColumnKey).length,
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
    const content = String(elements.newNoteText.value || '').trim();
    if (!content) {
      showAlert('Notiz benötigt eine Beschreibung.', true);
      return;
    }
    basePayload.content = content;
  }

  if (noteType === 'todo') {
    basePayload.todo_description = String(elements.newTodoDescription.value || '').trim();
    const firstTodo = String(elements.newTodoItem.value || '').trim();
    if (firstTodo) {
      basePayload.todo_items = [{ text: firstTodo, done: false, done_by_uid: null, done_by_name: null, done_at: null }];
    }
  }

  if (noteType === 'counter') {
    const targetValue = Number(elements.newCounterStart.value || 1);
    basePayload.counter_description = String(elements.newCounterDescription.value || '').trim();
    if (!basePayload.counter_description) {
      showAlert('Counter-Notiz benötigt eine Beschreibung.', true);
      return;
    }
    basePayload.counter_start_value = Number.isFinite(targetValue) && targetValue > 0 ? Math.round(targetValue) : 1;
    basePayload.counter_value = 0;
  }

  const { error } = await state.supabase.from(KANBAN_TABLE).insert(basePayload);
  if (error) {
    showAlert(`Notiz konnte nicht erstellt werden: ${error.message}`, true);
    return;
  }

  elements.createNoteForm?.reset();
  updateCreateTypeFields();
  await loadData();
}

async function handlePanelClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const noteId = String(button.dataset.noteId || '').trim();
  if (!noteId) return;

  if (button.dataset.action === 'save-text') {
    await saveTextNote(noteId);
    return;
  }

  if (button.dataset.action === 'save-todo-meta') {
    await saveTodoMeta(noteId);
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

  if (button.dataset.action === 'confirm-counter-plus') {
    await incrementCounter(noteId);
    return;
  }

  if (button.dataset.action === 'delete-attachment') {
    const index = Number(button.dataset.index);
    if (Number.isInteger(index) && index >= 0) {
      await deleteAttachment(noteId, index);
    }
  }
}

async function handlePanelChange(event) {
  const action = String(event.target.dataset.action || '').trim();
  const noteId = String(event.target.dataset.noteId || '').trim();
  if (!noteId) return;

  if (action === 'toggle-todo') {
    const index = Number(event.target.dataset.index);
    await toggleTodoItem(noteId, index, Boolean(event.target.checked));
    return;
  }

  if (action === 'upload-attachment') {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadAttachment(noteId, file);
    event.target.value = '';
  }
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
  const { error } = await state.supabase.from(KANBAN_TABLE).update({ todo_items: items }).eq('id', noteId);
  if (error) {
    showAlert(`To-do konnte nicht aktualisiert werden: ${error.message}`, true);
    return;
  }
  await loadData();
}

async function handleBoardChange(event) {
  const action = String(event.target.dataset.action || '').trim();
  const noteId = String(event.target.dataset.noteId || '').trim();
  if (!noteId) return;
  if (action === 'toggle-todo') {
    await toggleTodoItem(noteId, Number(event.target.dataset.index), Boolean(event.target.checked));
  }
  if (action === 'upload-attachment') {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadAttachment(noteId, file);
    event.target.value = '';
  }
}

async function handleBoardKeydown(event) {
  if (event.key !== 'Enter') return;
  const input = event.target.closest('[data-field="todo-input"]');
  if (!input) return;
  event.preventDefault();
  await addTodoItem(String(input.dataset.noteId || '').trim(), input);
}

function switchPanelTab(tab) {
  if (!tab) return;
  state.panelTab = tab;
  renderPanel();
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
  elements.createNoteForm.reset();
  if (elements.newCounterStart) elements.newCounterStart.value = '1';
  if (elements.newNoteType) elements.newNoteType.value = 'text';
  updateCreateTypeFields();
  if (String(elements.newNoteType?.value || '') === 'text') {
    elements.newNoteText?.focus();
  } else if (String(elements.newNoteType?.value || '') === 'todo') {
    elements.newTodoDescription?.focus();
  } else {
    elements.newCounterDescription?.focus();
  }
}

async function saveTextNote(noteId) {
  const contentInput = document.querySelector(`[data-field="content"][data-note-id="${noteId}"]`);
  const payload = {
    title: '',
    content: String(contentInput?.value || '').trim(),
  };
  if (!payload.content) {
    showAlert('Notiz darf nicht leer sein.', true);
    return;
  }
  const { error } = await state.supabase.from(KANBAN_TABLE).update(payload).eq('id', noteId);
  if (error) {
    showAlert(`Notiz konnte nicht gespeichert werden: ${error.message}`, true);
    return;
  }
  showAlert('Notiz gespeichert.');
  await loadData();
}

async function saveTodoMeta(noteId) {
  const descriptionInput = document.querySelector(`[data-field="todo-description"][data-note-id="${noteId}"]`);
  const todo_description = String(descriptionInput?.value || '').trim();
  const { error } = await state.supabase.from(KANBAN_TABLE).update({ todo_description, title: '' }).eq('id', noteId);
  if (error) {
    showAlert(`Beschreibung konnte nicht gespeichert werden: ${error.message}`, true);
    return;
  }
  showAlert('Beschreibung gespeichert.');
  await loadData();
}

async function addTodoItem(noteId, inputElement = null) {
  const input = inputElement || document.querySelector(`[data-field="todo-input"][data-note-id="${noteId}"]`);
  const text = String(input?.value || '').trim();
  if (!text) {
    showAlert('Bitte To-do Text eingeben.', true);
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
  await loadData();
}

async function saveCounterMeta(noteId) {
  const descriptionInput = document.querySelector(`[data-field="counter-description"][data-note-id="${noteId}"]`);
  const counter_description = String(descriptionInput?.value || '').trim();
  if (!counter_description) {
    showAlert('Counter-Beschreibung ist erforderlich.', true);
    return;
  }
  const payload = {
    title: '',
    counter_description,
  };
  const { error } = await state.supabase.from(KANBAN_TABLE).update(payload).eq('id', noteId);
  if (error) {
    showAlert(`Counter-Metadaten konnten nicht gespeichert werden: ${error.message}`, true);
    return;
  }
  showAlert('Counter-Metadaten gespeichert.');
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
