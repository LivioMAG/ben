const CONFIG_PATH = './supabase-config.json';
const KANBAN_TABLE = 'project_kanban_notes';
const PROJECTS_TABLE = 'projects';
const KANBAN_COLUMNS = [
  { key: 'todo', label: 'To-Do' },
  { key: 'planned', label: 'Geplant' },
  { key: 'in_progress', label: 'In Bearbeitung' },
  { key: 'review', label: 'Kontrolle' },
  { key: 'done', label: 'Erledigt' },
];

const state = {
  supabase: null,
  projectId: '',
  project: null,
  notes: [],
  draggedNoteId: null,
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
  elements.noteForm = document.getElementById('noteForm');
  elements.noteText = document.getElementById('noteText');
  elements.noteProgress = document.getElementById('noteProgress');
  elements.alert = document.getElementById('alert');
}

function bindEvents() {
  elements.backButton?.addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = './index.html';
  });
  elements.noteForm?.addEventListener('submit', handleCreateNote);
  elements.kanbanBoard?.addEventListener('dragstart', handleDragStart);
  elements.kanbanBoard?.addEventListener('dragover', handleDragOver);
  elements.kanbanBoard?.addEventListener('drop', handleDrop);
  elements.kanbanBoard?.addEventListener('change', handleBoardChange);
  elements.kanbanBoard?.addEventListener('click', handleBoardClick);
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
  if (elements.projectTitle) {
    elements.projectTitle.textContent = state.project?.name || 'Auftrag';
  }
  if (elements.projectMeta) {
    const commission = state.project?.commission_number ? `Kommission ${state.project.commission_number}` : '';
    elements.projectMeta.textContent = commission;
  }
  if (elements.projectBudget) {
    const budget = Number(state.project?.budget || 0);
    elements.projectBudget.textContent = `Budget: ${budget > 0 ? formatCurrency(budget) : '–'}`;
  }
  renderBoard();
}

function renderBoard() {
  if (!elements.kanbanBoard) return;
  elements.kanbanBoard.innerHTML = KANBAN_COLUMNS.map((column) => {
    const notes = state.notes.filter((entry) => entry.status === column.key).sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
    return `
      <section class="kanban-column" data-column="${escapeAttribute(column.key)}">
        <header>${escapeHtml(column.label)} <span class="count">${notes.length}</span></header>
        <div class="kanban-dropzone" data-column="${escapeAttribute(column.key)}">
          ${notes.map((note) => renderCard(note)).join('')}
        </div>
      </section>
    `;
  }).join('');
}

function renderCard(note) {
  const history = Array.isArray(note.checklist_history) ? note.checklist_history : [];
  const historyLines = history.length
    ? `<ul class="history-list">${history.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('')}</ul>`
    : '';
  const progress = clampProgress(note.progress_percent);
  return `
    <article class="kanban-card" draggable="true" data-note-id="${escapeAttribute(note.id)}">
      <textarea class="card-text" data-field="content" data-note-id="${escapeAttribute(note.id)}" rows="5">${escapeHtml(note.content || '')}</textarea>
      <div class="card-controls">
        <label>Fortschritt
          <input type="range" min="0" max="100" value="${escapeAttribute(progress)}" data-field="progress" data-note-id="${escapeAttribute(note.id)}" />
        </label>
        <strong>${escapeHtml(String(progress))}%</strong>
      </div>
      <div class="progress-bar"><span style="width:${escapeAttribute(progress)}%"></span></div>
      <div class="card-actions">
        <button type="button" class="button-secondary" data-action="history" data-note-id="${escapeAttribute(note.id)}">+ Erledigungseintrag</button>
        <button type="button" class="button-danger" data-action="delete" data-note-id="${escapeAttribute(note.id)}">Löschen</button>
      </div>
      ${historyLines}
    </article>
  `;
}

async function handleCreateNote(event) {
  event.preventDefault();
  const content = String(elements.noteText?.value || '').trim();
  const progress = clampProgress(elements.noteProgress?.value);
  if (!content) {
    showAlert('Bitte Text eingeben.', true);
    return;
  }

  const nextPosition = state.notes.filter((entry) => entry.status === 'todo').length;
  const { error } = await state.supabase.from(KANBAN_TABLE).insert({
    project_id: state.projectId,
    status: 'todo',
    position: nextPosition,
    content,
    progress_percent: progress,
    checklist_history: [],
  });
  if (error) {
    showAlert(`Karte konnte nicht gespeichert werden: ${error.message}`, true);
    return;
  }

  elements.noteForm.reset();
  elements.noteProgress.value = '0';
  await loadData();
}

function handleDragStart(event) {
  const card = event.target.closest('.kanban-card');
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

  const newPosition = state.notes.filter((entry) => entry.status === newStatus).length;
  const { error } = await state.supabase
    .from(KANBAN_TABLE)
    .update({ status: newStatus, position: newPosition })
    .eq('id', note.id);

  document.querySelector('.kanban-card.dragging')?.classList.remove('dragging');
  state.draggedNoteId = null;

  if (error) {
    showAlert(`Verschieben fehlgeschlagen: ${error.message}`, true);
    return;
  }
  await loadData();
}

async function handleBoardChange(event) {
  const noteId = String(event.target.dataset.noteId || '').trim();
  const field = String(event.target.dataset.field || '').trim();
  if (!noteId || !field) return;

  if (field === 'content') {
    const content = String(event.target.value || '').trim();
    const { error } = await state.supabase.from(KANBAN_TABLE).update({ content }).eq('id', noteId);
    if (error) showAlert(`Text konnte nicht gespeichert werden: ${error.message}`, true);
    return;
  }

  if (field === 'progress') {
    const progress = clampProgress(event.target.value);
    const { error } = await state.supabase.from(KANBAN_TABLE).update({ progress_percent: progress }).eq('id', noteId);
    if (error) {
      showAlert(`Fortschritt konnte nicht gespeichert werden: ${error.message}`, true);
      return;
    }
    await loadData();
  }
}

async function handleBoardClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const noteId = String(button.dataset.noteId || '').trim();
  if (!noteId) return;

  if (button.dataset.action === 'delete') {
    const { error } = await state.supabase.from(KANBAN_TABLE).delete().eq('id', noteId);
    if (error) {
      showAlert(`Karte konnte nicht gelöscht werden: ${error.message}`, true);
      return;
    }
    await loadData();
    return;
  }

  if (button.dataset.action === 'history') {
    const note = state.notes.find((entry) => String(entry.id) === noteId);
    if (!note) return;
    const text = prompt('Kurze Notiz für den Erledigungseintrag (optional):', '');
    if (text === null) return;
    const history = Array.isArray(note.checklist_history) ? [...note.checklist_history] : [];
    history.push(`${new Date().toLocaleString('de-CH')}${text ? ` – ${text}` : ''}`);
    const { error } = await state.supabase.from(KANBAN_TABLE).update({ checklist_history: history }).eq('id', noteId);
    if (error) {
      showAlert(`Erledigungseintrag fehlgeschlagen: ${error.message}`, true);
      return;
    }
    await loadData();
  }
}

function clampProgress(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
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
