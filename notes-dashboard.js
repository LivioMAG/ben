(function () {
  const DASHBOARD_TABLE = 'dashboard_notes';
  const ATTACHMENTS_TABLE = 'dashboard_note_attachments';
  const TODOS_TABLE = 'dashboard_note_todos';
  const STORAGE_BUCKET = 'dashboard-note-attachments';
  const GRID_SIZE = 4;
  const DEFAULT_NOTE_WIDTH = 168;
  const DEFAULT_NOTE_HEIGHT = 120;
  const CARD_PREVIEW_MAX_LENGTH = 120;
  const LONG_PRESS_DELAY_MS = 520;
  const DRAG_START_THRESHOLD_PX = 6;
  const EXPANDED_NOTE_TODO_MAX_ITEMS = 8;
  const EXPANDED_NOTE_FIXED_WIDTH = 400;
  const EXPANDED_NOTE_WITH_HISTORY_WIDTH = EXPANDED_NOTE_FIXED_WIDTH + 200;
  const EXPANDED_NOTE_BASE_HEIGHT = 300;
  const EXPANDED_NOTE_CONTENT_HEIGHT = 140;
  const EXPANDED_NOTE_TODO_HEIGHT_STEP = 18;
  const EXPANDED_NOTE_PADDING = 12;
  const DEFAULT_NOTE_COLOR = 'yellow';
  const NOTE_COLORS = {
    green: '#dff4df',
    blue: '#dcecff',
    yellow: '#fff2b8',
    red: '#ffd7d7',
  };
  const COLOR_STACK_ORDER = {
    green: 0,
    blue: 1,
    yellow: 2,
    red: 3,
  };

  class NotesDashboard {
    constructor(options) {
      this.options = options || {};
      this.root = this.options.root || null;
      this.canvas = this.options.canvas || null;
      this.actionBar = this.options.actionBar || null;
      this.attachmentModal = this.options.attachmentModal || null;
      this.attachmentModalList = this.options.attachmentModalList || null;
      this.attachmentModalFileInput = this.options.attachmentModalFileInput || null;
      this.attachmentModalCloseButton = this.options.attachmentModalCloseButton || null;

      this.notes = [];
      this.activeNoteId = null;
      this.dragState = null;
      this.pressState = null;
      this.editingNoteId = null;
      this.expandedNoteId = null;
      this.inlineSaveTimer = null;
      this.replySaveTimer = null;
      this.replyDrafts = new Map();
      this.todoSaveTimers = new Map();
      this.boundResize = this.handleViewportResize.bind(this);

      this.bindEvents();
    }

    getSupabase() {
      return typeof this.options.getSupabase === 'function' ? this.options.getSupabase() : null;
    }

    getUserId() {
      return typeof this.options.getUserId === 'function' ? this.options.getUserId() : null;
    }

    reportError(message, error) {
      if (typeof this.options.onError === 'function') {
        this.options.onError(message, error);
      } else {
        console.error(message, error);
      }
    }

    bindEvents() {
      if (!this.root || !this.canvas) return;
      this.canvas.addEventListener('dblclick', (event) => this.handleCanvasDoubleClick(event));
      this.canvas.addEventListener('pointerdown', (event) => this.handleCanvasPointerDown(event));
      this.canvas.addEventListener('click', (event) => this.handleCanvasClick(event));
      this.canvas.addEventListener('dblclick', (event) => this.handleNoteDoubleClick(event));
      this.canvas.addEventListener('input', (event) => this.handleInlineEditorInput(event));
      this.canvas.addEventListener('input', (event) => this.handleReplyInput(event));
      this.canvas.addEventListener('input', (event) => this.handleTodoInput(event));
      this.canvas.addEventListener('change', (event) => this.handleTodoToggle(event));
      this.canvas.addEventListener('keydown', (event) => this.handleTodoKeyDown(event));
      this.canvas.addEventListener('click', (event) => this.handleTodoDeleteClick(event));
      this.canvas.addEventListener('focusout', (event) => this.handleInlineEditorFocusOut(event));
      this.canvas.addEventListener('focusout', (event) => this.handleReplyFocusOut(event));
      this.canvas.addEventListener('focusout', (event) => this.handleTodoFocusOut(event));

      if (this.attachmentModal) {
        this.attachmentModal.addEventListener('click', (event) => this.handleAttachmentModalClick(event));
      }
      if (this.attachmentModalFileInput) {
        this.attachmentModalFileInput.addEventListener('change', (event) => this.handleAttachmentUpload(event));
      }
      if (this.attachmentModalCloseButton) {
        this.attachmentModalCloseButton.addEventListener('click', () => this.closeAttachmentModal());
      }
      window.addEventListener('resize', this.boundResize);
    }

    destroy() {
      window.removeEventListener('resize', this.boundResize);
      this.clearPressState();
      if (this.inlineSaveTimer) {
        window.clearTimeout(this.inlineSaveTimer);
        this.inlineSaveTimer = null;
      }
      if (this.replySaveTimer) {
        window.clearTimeout(this.replySaveTimer);
        this.replySaveTimer = null;
      }
      this.todoSaveTimers.forEach((timerId) => window.clearTimeout(timerId));
      this.todoSaveTimers.clear();
    }

    async refresh() {
      const supabase = this.getSupabase();
      const userId = this.getUserId();
      if (!supabase || !userId || !this.canvas) return;

      try {
        const [
          { data: notes, error: notesError },
          { data: attachments, error: attachmentsError },
          { data: todos, error: todosError },
        ] = await Promise.all([
          supabase
            .from(DASHBOARD_TABLE)
            .select('*')
            .eq('user_id', userId)
            .is('deleted_at', null)
            .order('created_at', { ascending: true }),
          supabase
            .from(ATTACHMENTS_TABLE)
            .select('*')
            .eq('user_id', userId)
            .is('deleted_at', null)
            .order('created_at', { ascending: true }),
          supabase
            .from(TODOS_TABLE)
            .select('*')
            .eq('user_id', userId)
            .is('deleted_at', null)
            .order('position', { ascending: true })
            .order('created_at', { ascending: true }),
        ]);

        if (notesError) throw notesError;
        if (attachmentsError) throw attachmentsError;
        if (todosError) throw todosError;

        this.notes = (notes || []).map((note) => ({
          ...note,
          conversation: this.normalizeConversation(note.content),
          preview_text: this.getNormalizedPreviewText(note.preview_text, note.content),
          note_color: this.normalizeNoteColor(note.note_color),
          attachments: (attachments || []).filter((attachment) => String(attachment.note_id) === String(note.id)),
          todos: (todos || []).filter((todo) => String(todo.note_id) === String(note.id)),
        }));
        this.normalizeAllPositions();
        this.render();
      } catch (error) {
        this.reportError('Notizen konnten nicht geladen werden.', error);
      }
    }

    clear() {
      this.notes = [];
      this.activeNoteId = null;
      this.dragState = null;
      this.clearPressState();
      this.todoSaveTimers.forEach((timerId) => window.clearTimeout(timerId));
      this.todoSaveTimers.clear();
      this.replyDrafts.clear();
      this.render();
      this.hideActionBar();
      this.closeAttachmentModal();
    }

    handleCanvasDoubleClick(event) {
      if (!(event.target instanceof HTMLElement)) return;
      if (event.target.closest('.dashboard-note')) return;
      const bounds = this.canvas.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      this.createNoteAt(x, y).catch((error) => this.reportError('Notiz konnte nicht erstellt werden.', error));
    }

    async createNoteAt(x, y) {
      const supabase = this.getSupabase();
      const userId = this.getUserId();
      if (!supabase || !userId) return;

      const normalized = this.normalizePosition({
        posX: x,
        posY: y,
        width: DEFAULT_NOTE_WIDTH,
        height: DEFAULT_NOTE_HEIGHT,
      });

      const { data, error } = await supabase
        .from(DASHBOARD_TABLE)
        .insert({
          user_id: userId,
          content: [],
          preview_text: '',
          pos_x: normalized.posX,
          pos_y: normalized.posY,
          width: normalized.width,
          height: normalized.height,
          note_color: DEFAULT_NOTE_COLOR,
        })
        .select('*')
        .single();

      if (error) throw error;

      this.notes.push({
        ...data,
        conversation: this.normalizeConversation(data.content),
        preview_text: this.getNormalizedPreviewText(data.preview_text, data.content),
        attachments: [],
        todos: [],
      });
      this.activeNoteId = data.id;
      this.startInlineEditing(data.id);
    }

    handleCanvasPointerDown(event) {
      if (!(event.target instanceof HTMLElement)) return;
      const colorTrigger = event.target.closest('.dashboard-note-color-dot');
      if (colorTrigger) {
        const noteElement = event.target.closest('.dashboard-note');
        const noteId = noteElement?.dataset.noteId;
        const note = this.notes.find((entry) => String(entry.id) === String(noteId));
        const selectedColor = colorTrigger.getAttribute('data-note-color');
        if (note && selectedColor && NOTE_COLORS[selectedColor]) {
          this.activeNoteId = note.id;
          this.applyNoteColor(note, selectedColor).catch((error) => this.reportError('Notizfarbe konnte nicht gespeichert werden.', error));
        }
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.target.closest('[data-note-action]')) {
        event.preventDefault();
        return;
      }
      const note = event.target.closest('.dashboard-note');
      if (!note) {
        this.clearSelection();
        return;
      }

      const noteId = note.dataset.noteId;
      const active = this.notes.find((entry) => String(entry.id) === String(noteId));
      if (!active) return;

      this.activeNoteId = active.id;
      const isEditingInteraction = this.isEditableInteractionTarget(event.target, active.id);
      if (isEditingInteraction) {
        return;
      }
      if (String(this.expandedNoteId) === String(active.id)) {
        return;
      }
      this.pressState = {
        pointerId: event.pointerId,
        noteId: active.id,
        noteElement: note,
        startClientX: event.clientX,
        startClientY: event.clientY,
        clientX: event.clientX,
        clientY: event.clientY,
        didDrag: false,
      };
      this.pressState.timerId = window.setTimeout(() => this.handleLongPress(event.pointerId), LONG_PRESS_DELAY_MS);
      note.setPointerCapture(event.pointerId);
      this.bindDragListeners();
      this.render();
    }

    isEditableInteractionTarget(target, noteId) {
      if (!(target instanceof HTMLElement)) return false;
      if (String(this.editingNoteId) !== String(noteId)) return false;
      return Boolean(
        target.closest('.dashboard-note-content')
        || target.closest('.dashboard-note-reply-input')
        || target.closest('.dashboard-note-todo-list'),
      );
    }

    handleCanvasClick(event) {
      if (!(event.target instanceof HTMLElement)) return;
      const actionTrigger = event.target.closest('[data-note-action]');
      const colorTrigger = event.target.closest('.dashboard-note-color-dot');
      if (!actionTrigger && !colorTrigger) return;
      const noteElement = event.target.closest('.dashboard-note');
      const noteId = noteElement?.dataset.noteId;
      const note = this.notes.find((entry) => String(entry.id) === String(noteId));
      if (!note) return;
      event.preventDefault();
      event.stopPropagation();

      if (colorTrigger) {
        const selectedColor = colorTrigger.getAttribute('data-note-color');
        if (!selectedColor || !NOTE_COLORS[selectedColor]) return;
        this.applyNoteColor(note, selectedColor).catch((error) => this.reportError('Notizfarbe konnte nicht gespeichert werden.', error));
        return;
      }

      const action = actionTrigger?.getAttribute('data-note-action');
      if (action === 'attachments') {
        this.openAttachmentModal(note.id);
      } else if (action === 'add-todo') {
        this.createTodo(note.id).catch((error) => this.reportError('To-do konnte nicht erstellt werden.', error));
      } else if (action === 'collapse') {
        this.collapseExpandedNote(note.id);
      }
    }

    handleNoteDoubleClick(event) {
      const note = event.target instanceof HTMLElement ? event.target.closest('.dashboard-note') : null;
      if (!note) return;
      const noteId = note.dataset.noteId;
      if (!noteId) return;
      this.startInlineEditing(noteId);
    }

    bindDragListeners() {
      if (!this.handleNotePointerMoveBound) {
        this.handleNotePointerMoveBound = (event) => this.handleNotePointerMove(event);
      }
      if (!this.handleNotePointerUpBound) {
        this.handleNotePointerUpBound = (event) => this.handleNotePointerUp(event);
      }
      document.addEventListener('pointermove', this.handleNotePointerMoveBound);
      document.addEventListener('pointerup', this.handleNotePointerUpBound);
      document.addEventListener('pointercancel', this.handleNotePointerUpBound);
    }

    unbindDragListeners() {
      if (!this.handleNotePointerMoveBound || !this.handleNotePointerUpBound) return;
      document.removeEventListener('pointermove', this.handleNotePointerMoveBound);
      document.removeEventListener('pointerup', this.handleNotePointerUpBound);
      document.removeEventListener('pointercancel', this.handleNotePointerUpBound);
    }

    handleNotePointerMove(event) {
      if (this.dragState && event.pointerId === this.dragState.pointerId) {
        const note = this.notes.find((entry) => String(entry.id) === String(this.dragState.noteId));
        if (!note) return;
        const bounds = this.canvas.getBoundingClientRect();
        const next = this.normalizePosition({
          posX: event.clientX - bounds.left - this.dragState.offsetX,
          posY: event.clientY - bounds.top - this.dragState.offsetY,
          width: Number(note.width || DEFAULT_NOTE_WIDTH),
          height: Number(note.height || DEFAULT_NOTE_HEIGHT),
        });
        note.pos_x = next.posX;
        note.pos_y = next.posY;
        this.updateDraggedNotePosition(note);
        this.updateTrashTargetState(event.clientX, event.clientY);
        return;
      }
      if (!this.pressState || event.pointerId !== this.pressState.pointerId) return;
      this.pressState.clientX = event.clientX;
      this.pressState.clientY = event.clientY;
      const note = this.notes.find((entry) => String(entry.id) === String(this.pressState.noteId));
      if (!note) return;
      const movedEnough = Math.hypot(
        event.clientX - this.pressState.startClientX,
        event.clientY - this.pressState.startClientY,
      ) >= DRAG_START_THRESHOLD_PX;
      if (!movedEnough) return;
      this.clearPressTimer();
      this.pressState.didDrag = true;
      this.startDraggingNote(note, this.pressState.noteElement, event);
      this.showActionBar();
      this.handleNotePointerMove(event);
    }

    async handleNotePointerUp(event) {
      if (this.dragState && event.pointerId === this.dragState.pointerId) {
        const { noteId, noteElement, pointerId } = this.dragState;
        if (noteElement?.hasPointerCapture(pointerId)) {
          noteElement.releasePointerCapture(pointerId);
        }
        const note = this.notes.find((entry) => String(entry.id) === String(noteId));
        this.dragState = null;
        this.unbindDragListeners();
        this.clearTrashTargetState();

        if (this.isOverTrash(event.clientX, event.clientY)) {
          await this.deleteNoteById(noteId);
          return;
        }

        if (note) {
          await this.persistPosition(note);
        }
        this.hideActionBar();
        this.render();
        return;
      }

      if (!this.pressState || event.pointerId !== this.pressState.pointerId) return;
      const { noteElement, pointerId, noteId } = this.pressState;
      if (noteElement?.hasPointerCapture(pointerId)) {
        noteElement.releasePointerCapture(pointerId);
      }
      const longPressTriggered = Boolean(this.pressState.longPressTriggered);
      const didDrag = Boolean(this.pressState.didDrag);
      this.clearPressState();
      this.unbindDragListeners();
      if (!longPressTriggered && !didDrag) {
        this.startInlineEditing(noteId);
      }
    }

    startDraggingNote(note, noteElement, event) {
      if (!note || !noteElement) return;
      const bounds = this.canvas.getBoundingClientRect();
      this.dragState = {
        pointerId: event.pointerId,
        noteId: note.id,
        noteElement,
        offsetX: event.clientX - bounds.left - Number(note.pos_x || 0),
        offsetY: event.clientY - bounds.top - Number(note.pos_y || 0),
      };
    }

    handleLongPress(pointerId) {
      if (!this.pressState || this.pressState.pointerId !== pointerId) return;
      this.pressState.longPressTriggered = true;
    }

    clearPressTimer() {
      if (!this.pressState?.timerId) return;
      window.clearTimeout(this.pressState.timerId);
      this.pressState.timerId = null;
    }

    clearPressState() {
      this.clearPressTimer();
      this.pressState = null;
    }

    updateDraggedNotePosition(note) {
      if (!this.canvas || !note) return;
      const element = this.canvas.querySelector(`.dashboard-note[data-note-id="${CSS.escape(String(note.id))}"]`);
      if (!element) {
        this.render();
        return;
      }
      element.style.left = `${Number(note.pos_x || 0)}px`;
      element.style.top = `${Number(note.pos_y || 0)}px`;
    }

    updateTrashTargetState(clientX, clientY) {
      if (!this.actionBar) return;
      this.actionBar.classList.toggle('dashboard-action-bar-trash-hover', this.isOverTrash(clientX, clientY));
    }

    clearTrashTargetState() {
      if (!this.actionBar) return;
      this.actionBar.classList.remove('dashboard-action-bar-trash-hover');
    }

    isOverTrash(clientX, clientY) {
      const trash = this.actionBar?.querySelector('[data-role="trash"]');
      if (!trash) return false;
      const rect = trash.getBoundingClientRect();
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    }

    async persistPosition(note) {
      const supabase = this.getSupabase();
      if (!supabase) return;
      await supabase.from(DASHBOARD_TABLE).update({
        pos_x: note.pos_x,
        pos_y: note.pos_y,
        width: note.width,
        height: note.height,
      }).eq('id', note.id);
    }

    openAttachmentModal(noteId) {
      if (!this.attachmentModal) return;
      this.activeNoteId = noteId;
      this.attachmentModal.classList.remove('hidden');
      this.renderAttachmentModal();
    }

    closeAttachmentModal() {
      if (!this.attachmentModal) return;
      this.attachmentModal.classList.add('hidden');
      if (this.attachmentModalFileInput) {
        this.attachmentModalFileInput.value = '';
      }
    }

    getActiveNote() {
      return this.notes.find((entry) => String(entry.id) === String(this.activeNoteId));
    }

    renderAttachmentModal() {
      if (!this.attachmentModalList) return;
      const note = this.getActiveNote();
      if (!note) {
        this.attachmentModalList.innerHTML = '<li class="subtle-text">Keine Notiz ausgewählt.</li>';
        return;
      }
      if (!note.attachments?.length) {
        this.attachmentModalList.innerHTML = '<li class="subtle-text">Keine Anhänge vorhanden.</li>';
        return;
      }
      this.attachmentModalList.innerHTML = note.attachments.map((attachment) => {
        const url = this.getAttachmentUrl(attachment);
        const name = this.escapeHtml(attachment.file_name || 'Anhang');
        return `<li class="dashboard-note-attachment-item">
          <a href="${this.escapeAttribute(url)}" target="_blank" rel="noopener">${name}</a>
          <button type="button" class="button button-danger dashboard-note-attachment-delete" data-attachment-id="${this.escapeAttribute(attachment.id)}">Löschen</button>
        </li>`;
      }).join('');
    }

    async handleAttachmentModalClick(event) {
      if (!(event.target instanceof HTMLElement)) return;
      if (event.target.closest('[data-close-note-attachment-modal="true"]')) {
        this.closeAttachmentModal();
        return;
      }
      const deleteButton = event.target.closest('.dashboard-note-attachment-delete');
      if (!(deleteButton instanceof HTMLElement)) return;
      const attachmentId = deleteButton.getAttribute('data-attachment-id');
      if (!attachmentId) return;
      await this.deleteAttachmentById(attachmentId);
      this.renderAttachmentModal();
      this.render();
    }

    async deleteNoteById(noteId) {
      const supabase = this.getSupabase();
      if (!supabase) return;
      const deletedAt = new Date().toISOString();
      await Promise.all([
        supabase.from(DASHBOARD_TABLE).update({ deleted_at: deletedAt }).eq('id', noteId),
        supabase.from(ATTACHMENTS_TABLE).update({ deleted_at: deletedAt }).eq('note_id', noteId),
        supabase.from(TODOS_TABLE).update({ deleted_at: deletedAt }).eq('note_id', noteId),
      ]);
      this.notes = this.notes.filter((entry) => String(entry.id) !== String(noteId));
      if (String(this.activeNoteId) === String(noteId)) {
        this.activeNoteId = null;
        this.closeAttachmentModal();
      }
      this.render();
    }

    async handleAttachmentUpload(event) {
      const note = this.getActiveNote();
      const supabase = this.getSupabase();
      const userId = this.getUserId();
      const files = Array.from(event.target?.files || []);
      if (!note || !supabase || !userId || !files.length) return;

      for (const file of files) {
        const path = `${userId}/${note.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false });
        if (uploadError) {
          this.reportError('Anhang konnte nicht hochgeladen werden.', uploadError);
          continue;
        }

        const { data, error } = await supabase
          .from(ATTACHMENTS_TABLE)
          .insert({
            note_id: note.id,
            user_id: userId,
            file_name: file.name,
            file_path: path,
            file_mime_type: file.type || null,
            file_size_bytes: file.size,
          })
          .select('*')
          .single();

        if (error) {
          this.reportError('Anhang konnte nicht gespeichert werden.', error);
          continue;
        }

        note.attachments = [...(note.attachments || []), data];
      }

      if (this.attachmentModalFileInput) {
        this.attachmentModalFileInput.value = '';
      }
      this.render();
      this.renderAttachmentModal();
    }

    async deleteAttachmentById(attachmentId) {
      const supabase = this.getSupabase();
      if (!supabase) return;
      const note = this.getActiveNote();
      const attachment = note?.attachments?.find((entry) => String(entry.id) === String(attachmentId));
      if (!attachment) return;
      await supabase.from(ATTACHMENTS_TABLE).update({ deleted_at: new Date().toISOString() }).eq('id', attachmentId);
      if (attachment.file_path) {
        await supabase.storage.from(STORAGE_BUCKET).remove([attachment.file_path]);
      }
      note.attachments = (note.attachments || []).filter((entry) => String(entry.id) !== String(attachmentId));
    }

    getAttachmentUrl(attachment) {
      const supabase = this.getSupabase();
      if (!supabase || !attachment?.file_path) return '';
      const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(attachment.file_path);
      return data?.publicUrl || '';
    }

    normalizeAllPositions() {
      if (!this.hasRenderableCanvasBounds()) return;
      this.notes = this.notes.map((note) => {
        const normalized = this.normalizePosition({
          posX: Number(note.pos_x || 0),
          posY: Number(note.pos_y || 0),
          width: Number(note.width || DEFAULT_NOTE_WIDTH),
          height: Number(note.height || DEFAULT_NOTE_HEIGHT),
        });
        return {
          ...note,
          pos_x: normalized.posX,
          pos_y: normalized.posY,
          width: normalized.width,
          height: normalized.height,
        };
      });
    }

    normalizePosition({ posX, posY, width, height }) {
      const bounds = this.canvas?.getBoundingClientRect();
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
        return {
          posX: this.snapToGrid(posX),
          posY: this.snapToGrid(posY),
          width: Math.max(140, Number(width || DEFAULT_NOTE_WIDTH)),
          height: Math.max(96, Number(height || DEFAULT_NOTE_HEIGHT)),
        };
      }
      const maxWidth = Math.max(140, Math.min(width || DEFAULT_NOTE_WIDTH, (bounds?.width || 240) - 12));
      const maxHeight = Math.max(96, Math.min(height || DEFAULT_NOTE_HEIGHT, (bounds?.height || 180) - 12));
      const maxX = Math.max(0, (bounds?.width || maxWidth) - maxWidth - 8);
      const maxY = Math.max(0, (bounds?.height || maxHeight) - maxHeight - 8);
      return {
        posX: Math.max(0, Math.min(this.snapToGrid(posX), maxX)),
        posY: Math.max(0, Math.min(this.snapToGrid(posY), maxY)),
        width: maxWidth,
        height: maxHeight,
      };
    }

    snapToGrid(value) {
      return Math.round(Number(value || 0) / GRID_SIZE) * GRID_SIZE;
    }

    hasRenderableCanvasBounds() {
      const bounds = this.canvas?.getBoundingClientRect();
      return Boolean(bounds && bounds.width > 0 && bounds.height > 0);
    }

    handleViewportResize() {
      if (!this.notes.length || !this.hasRenderableCanvasBounds()) return;
      this.normalizeAllPositions();
      this.render();
      this.persistAllPositions().catch((error) => this.reportError('Positionen konnten nicht aktualisiert werden.', error));
    }

    async persistAllPositions() {
      const supabase = this.getSupabase();
      if (!supabase) return;
      await Promise.all(this.notes.map((note) => supabase.from(DASHBOARD_TABLE).update({
        pos_x: note.pos_x,
        pos_y: note.pos_y,
        width: note.width,
        height: note.height,
      }).eq('id', note.id)));
    }

    clearSelection() {
      const hasActiveSelection = this.activeNoteId !== null && this.activeNoteId !== undefined;
      const isActionBarVisible = Boolean(this.actionBar?.classList.contains('visible'));
      if (!hasActiveSelection && !isActionBarVisible) {
        return;
      }
      this.activeNoteId = null;
      this.editingNoteId = null;
      this.expandedNoteId = null;
      this.hideActionBar();
      this.closeAttachmentModal();
      this.render();
    }

    showActionBar() {
      if (!this.actionBar) return;
      this.actionBar.classList.add('visible');
    }

    hideActionBar() {
      if (!this.actionBar) return;
      this.actionBar.classList.remove('visible');
      this.clearTrashTargetState();
    }

    render() {
      if (!this.canvas) return;
      this.applyExpandedLayoutVariables();
      if (!this.notes.length) {
        this.canvas.innerHTML = '<div class="dashboard-note-empty subtle-text">Doppelklick zum Erstellen einer Notiz.</div>';
        return;
      }

      const notesForRender = this.notes
        .map((note, index) => ({ note, index }))
        .sort((left, right) => {
          const leftColor = this.normalizeNoteColor(left.note.note_color);
          const rightColor = this.normalizeNoteColor(right.note.note_color);
          const leftPriority = COLOR_STACK_ORDER[leftColor] ?? Number.MAX_SAFE_INTEGER;
          const rightPriority = COLOR_STACK_ORDER[rightColor] ?? Number.MAX_SAFE_INTEGER;
          if (leftPriority !== rightPriority) {
            return leftPriority - rightPriority;
          }
          return left.index - right.index;
        })
        .map((entry) => entry.note);

      this.canvas.innerHTML = notesForRender.map((note) => {
        const conversation = this.normalizeConversation(note.conversation || note.content);
        const isExpanded = String(this.expandedNoteId) === String(note.id);
        const isEditing = String(this.editingNoteId) === String(note.id);
        const canEditLatestUser = this.canEditLatestUserMessage(conversation);
        const latestEditableText = this.getLatestEditableUserText(conversation);
        const previewSource = String(note.preview_text || this.getLatestConversationText(conversation));
        const cardPreview = this.getPreviewText(previewSource);
        const editorText = isEditing
          ? (canEditLatestUser ? latestEditableText : cardPreview)
          : cardPreview;
        const showHistoryPanel = isExpanded && conversation.length > 1;
        const historyMarkup = showHistoryPanel ? `
          <aside class="dashboard-note-history-panel" aria-label="Verlauf">
            <ul class="dashboard-note-history-list">
              ${[...conversation].reverse().map((entry) => `
                <li class="dashboard-note-history-entry role-${this.escapeAttribute(entry.role)}">
                  <div class="dashboard-note-history-meta">${entry.role === 'ai' ? 'AI' : 'User'} · ${this.formatEntryTimestamp(entry.created_at)}</div>
                  <div class="dashboard-note-history-text">${this.escapeHtml(entry.text || '')}</div>
                </li>
              `).join('')}
            </ul>
          </aside>
        ` : '';
        const responseInputMarkup = (isExpanded && isEditing && !canEditLatestUser) ? `
          <label class="dashboard-note-reply-label">
            <span>Antwort schreiben</span>
            <textarea
              class="dashboard-note-reply-input"
              data-note-reply-input="true"
              data-note-id="${this.escapeAttribute(note.id)}"
              rows="4"
              placeholder="Neue Antwort eingeben ..."
            >${this.escapeHtml(this.replyDrafts.get(String(note.id)) || '')}</textarea>
          </label>
        ` : '';
        const attachmentCount = Array.isArray(note.attachments) ? note.attachments.length : 0;
        const todoItems = Array.isArray(note.todos) ? note.todos : [];
        const todoCount = todoItems.length;
        const clampedTodoCount = Math.min(todoCount, EXPANDED_NOTE_TODO_MAX_ITEMS);
        const completedTodoCount = todoItems.filter((todo) => Boolean(todo.is_done)).length;
        const progressPercent = clampedTodoCount ? Math.round((completedTodoCount / clampedTodoCount) * 100) : 0;
        const noteWidth = Number(note.width || DEFAULT_NOTE_WIDTH);
        const noteHeight = Number(note.height || DEFAULT_NOTE_HEIGHT);
        const canvasWidth = Number(this.canvas?.clientWidth || 0);
        const canvasHeight = Number(this.canvas?.clientHeight || 0);
        const expandedWidth = this.getExpandedWidth(note, canvasWidth);
        const expandedHeight = this.getExpandedHeight(note, canvasHeight);
        const expandedPosition = this.getExpandedPosition(note, expandedWidth, expandedHeight);
        const renderedWidth = isExpanded
          ? expandedWidth
          : noteWidth;
        const renderedHeight = isExpanded
          ? expandedHeight
          : noteHeight;
        const renderedLeft = isExpanded ? expandedPosition.posX : Number(note.pos_x || 0);
        const renderedTop = isExpanded ? expandedPosition.posY : Number(note.pos_y || 0);
        const reservedTodoHeight = 110 + (clampedTodoCount * EXPANDED_NOTE_TODO_HEIGHT_STEP);
        const expandedContentHeight = Math.max(72, Math.min(EXPANDED_NOTE_CONTENT_HEIGHT, renderedHeight - reservedTodoHeight));
        const noteColorKey = this.normalizeNoteColor(note.note_color);
        const colorDots = Object.entries(NOTE_COLORS).map(([key, value]) => `
          <button
            type="button"
            class="dashboard-note-color-dot ${key === noteColorKey ? 'is-selected' : ''}"
            data-note-color="${this.escapeAttribute(key)}"
            style="--note-color-dot:${this.escapeAttribute(value)}"
            aria-label="Notizfarbe ${this.escapeAttribute(key)} auswählen"
          ></button>
        `).join('');
        const todoMarkup = isExpanded ? `
          <section class="dashboard-note-todo-section">
            <ul class="dashboard-note-todo-list">
              ${todoItems.map((todo) => `
                <li class="dashboard-note-todo-item ${todo.is_done ? 'is-done' : ''}" data-todo-id="${this.escapeAttribute(todo.id)}">
                  <input
                    type="checkbox"
                    class="dashboard-note-todo-checkbox"
                    data-todo-checkbox="true"
                    ${todo.is_done ? 'checked' : ''}
                    aria-label="To-do abhaken"
                  />
                  <span
                    class="dashboard-note-todo-input"
                    data-todo-input="true"
                    contenteditable="true"
                    role="textbox"
                    aria-label="To-do Text"
                    spellcheck="true"
                  >${this.escapeHtml(todo.content || '')}</span>
                  <button
                    type="button"
                    class="dashboard-note-todo-delete"
                    data-todo-delete="true"
                    aria-label="To-do löschen"
                    title="To-do löschen"
                  >✕</button>
                </li>
              `).join('')}
            </ul>
          </section>
        ` : '';
        const footerInfoMarkup = clampedTodoCount
          ? `
            <div class="dashboard-note-progress" aria-label="To-do Fortschritt ${completedTodoCount} von ${clampedTodoCount}">
              <span class="dashboard-note-progress-text">${completedTodoCount}/${clampedTodoCount}</span>
              <div class="dashboard-note-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="${clampedTodoCount}" aria-valuenow="${completedTodoCount}">
                <div class="dashboard-note-progress-fill" style="width:${progressPercent}%;"></div>
              </div>
            </div>
          `
          : '<span>Notiz</span>';
        return `
          <article
            class="dashboard-note ${String(this.activeNoteId) === String(note.id) ? 'active' : ''} ${isExpanded ? 'is-expanded' : ''} ${isEditing ? 'is-editing' : ''}"
            data-note-id="${this.escapeAttribute(note.id)}"
            style="left:${renderedLeft}px; top:${renderedTop}px; width:${renderedWidth}px; height:${renderedHeight}px; --dashboard-note-color:${this.escapeAttribute(NOTE_COLORS[noteColorKey])}; --dashboard-expanded-note-content-height:${expandedContentHeight}px;"
          >
            <div class="dashboard-note-main">
              <div
                class="dashboard-note-content ${isEditing && !canEditLatestUser ? 'is-readonly' : ''}"
                contenteditable="${isEditing && canEditLatestUser ? 'true' : 'false'}"
                spellcheck="${isEditing && canEditLatestUser ? 'true' : 'false'}"
              >${this.escapeHtml(editorText || ' ')}</div>
              ${responseInputMarkup}
            </div>
            ${historyMarkup}
            ${todoMarkup}
            <footer class="dashboard-note-footer">
              <div class="dashboard-note-footer-left">
                ${footerInfoMarkup}
                ${isExpanded ? `<div class="dashboard-note-colors">${colorDots}</div>` : ''}
              </div>
              <div class="dashboard-note-footer-actions">
                <button type="button" class="dashboard-note-icon-button" data-note-action="attachments" aria-label="Anhänge öffnen">📎 ${attachmentCount}</button>
                ${isExpanded ? `<button type="button" class="dashboard-note-icon-button" data-note-action="add-todo" aria-label="To-do hinzufügen" ${clampedTodoCount >= EXPANDED_NOTE_TODO_MAX_ITEMS ? 'disabled' : ''}>☑️</button>` : ''}
              </div>
            </footer>
          </article>
        `;
      }).join('');
      this.focusInlineEditorIfNeeded();
    }

    getExpandedWidth(note, canvasWidth = Number(this.canvas?.clientWidth || 0)) {
      const maxExpandedWidth = this.getExpandedMaxWidth(canvasWidth);
      const conversation = this.normalizeConversation(note?.conversation || note?.content);
      const targetWidth = conversation.length > 1 ? EXPANDED_NOTE_WITH_HISTORY_WIDTH : EXPANDED_NOTE_FIXED_WIDTH;
      return Math.max(240, Math.min(targetWidth, maxExpandedWidth));
    }

    getExpandedHeight(note, canvasHeight = Number(this.canvas?.clientHeight || 0)) {
      const todoCount = Array.isArray(note?.todos) ? note.todos.length : 0;
      const desiredHeight = EXPANDED_NOTE_BASE_HEIGHT + (Math.max(0, todoCount) * EXPANDED_NOTE_TODO_HEIGHT_STEP);
      const maxExpandedHeight = this.getExpandedMaxHeight(canvasHeight);
      return Math.max(140, Math.min(desiredHeight, maxExpandedHeight));
    }

    getExpandedMaxWidth(canvasWidth = Number(this.canvas?.clientWidth || 0)) {
      return Math.max(240, canvasWidth - (EXPANDED_NOTE_PADDING * 2));
    }

    getExpandedMaxHeight(canvasHeight = Number(this.canvas?.clientHeight || 0)) {
      return Math.max(140, canvasHeight - (EXPANDED_NOTE_PADDING * 2));
    }

    getExpandedPosition(note, expandedWidth, expandedHeight) {
      const normalized = this.normalizePosition({
        posX: Number(note?.pos_x || 0),
        posY: Number(note?.pos_y || 0),
        width: expandedWidth,
        height: expandedHeight,
      });
      return { posX: normalized.posX, posY: normalized.posY };
    }

    getPreviewText(content) {
      const normalized = String(content || '').trim();
      if (normalized.length <= CARD_PREVIEW_MAX_LENGTH) {
        return normalized;
      }
      return `${normalized.slice(0, CARD_PREVIEW_MAX_LENGTH)}...`;
    }

    normalizeConversation(rawValue) {
      if (!Array.isArray(rawValue)) return [];
      return rawValue
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => ({
          role: entry.role === 'ai' ? 'ai' : 'user',
          text: String(entry.text || ''),
          created_at: entry.created_at || new Date().toISOString(),
        }));
    }

    getLatestConversationText(conversation) {
      const normalized = this.normalizeConversation(conversation);
      if (!normalized.length) return '';
      const latest = normalized[normalized.length - 1];
      return String(latest.text || '');
    }

    getNormalizedPreviewText(previewText, conversation) {
      const normalizedPreview = String(previewText || '').trim();
      if (normalizedPreview) return normalizedPreview;
      return this.getLatestConversationText(conversation);
    }

    canEditLatestUserMessage(conversation) {
      const normalized = this.normalizeConversation(conversation);
      if (!normalized.length) return true;
      const latest = normalized[normalized.length - 1];
      return latest.role === 'user';
    }

    getLatestEditableUserText(conversation) {
      const normalized = this.normalizeConversation(conversation);
      if (!normalized.length) return '';
      const latest = normalized[normalized.length - 1];
      return latest.role === 'user' ? String(latest.text || '') : '';
    }

    formatEntryTimestamp(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleString('de-CH', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    focusInlineEditorIfNeeded() {
      if (!this.canvas || !this.editingNoteId) return;
      const note = this.notes.find((entry) => String(entry.id) === String(this.editingNoteId));
      if (!note) return;
      const conversation = this.normalizeConversation(note.conversation || note.content);
      const selector = this.canEditLatestUserMessage(conversation)
        ? '.dashboard-note-content'
        : '.dashboard-note-reply-input';
      const editor = this.canvas.querySelector(`.dashboard-note[data-note-id="${CSS.escape(String(this.editingNoteId))}"] ${selector}`);
      if (!(editor instanceof HTMLElement)) return;
      editor.focus();
      if (editor instanceof HTMLTextAreaElement) {
        editor.selectionStart = editor.value.length;
        editor.selectionEnd = editor.value.length;
        return;
      }
      const selection = window.getSelection?.();
      if (!selection) return;
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    startInlineEditing(noteId) {
      this.activeNoteId = noteId;
      this.expandedNoteId = noteId;
      this.editingNoteId = noteId;
      this.hideActionBar();
      this.render();
    }

    collapseExpandedNote(noteId) {
      if (String(this.expandedNoteId) !== String(noteId)) return;
      this.expandedNoteId = null;
      this.editingNoteId = null;
      this.render();
    }

    applyExpandedLayoutVariables() {
      if (!this.canvas) return;
      this.canvas.style.setProperty('--dashboard-expanded-note-content-height', `${EXPANDED_NOTE_CONTENT_HEIGHT}px`);
    }

    handleInlineEditorInput(event) {
      const contentEl = event.target instanceof HTMLElement ? event.target.closest('.dashboard-note-content') : null;
      if (!contentEl) return;
      const noteElement = contentEl.closest('.dashboard-note');
      const noteId = noteElement?.dataset.noteId;
      const note = this.notes.find((entry) => String(entry.id) === String(noteId));
      if (!note) return;
      note.pendingContentText = contentEl.textContent || '';
      this.scheduleInlineSave(note.id);
    }

    handleInlineEditorFocusOut(event) {
      const contentEl = event.target instanceof HTMLElement ? event.target.closest('.dashboard-note-content') : null;
      if (!contentEl) return;
      const noteElement = contentEl.closest('.dashboard-note');
      const noteId = noteElement?.dataset.noteId;
      if (!noteId) return;
      this.persistInlineSave(noteId).catch((error) => this.reportError('Notiz konnte nicht gespeichert werden.', error));
      if (String(this.expandedNoteId) !== String(noteId)) {
        this.editingNoteId = null;
        this.render();
      }
    }

    scheduleInlineSave(noteId) {
      if (this.inlineSaveTimer) {
        window.clearTimeout(this.inlineSaveTimer);
      }
      this.inlineSaveTimer = window.setTimeout(() => {
        this.persistInlineSave(noteId).catch((error) => this.reportError('Notiz konnte nicht gespeichert werden.', error));
      }, 450);
    }

    async persistInlineSave(noteId) {
      if (this.inlineSaveTimer) {
        window.clearTimeout(this.inlineSaveTimer);
        this.inlineSaveTimer = null;
      }
      const note = this.notes.find((entry) => String(entry.id) === String(noteId));
      if (!note) return;
      await this.saveNoteContent(note.id, note.pendingContentText ?? this.getLatestEditableUserText(note.conversation || note.content));
      delete note.pendingContentText;
      const isCurrentlyEditing = String(this.editingNoteId) === String(noteId);
      if (!isCurrentlyEditing) {
        this.render();
      }
    }

    async saveNoteContent(noteId, content) {
      const supabase = this.getSupabase();
      const note = this.notes.find((entry) => String(entry.id) === String(noteId));
      if (!supabase || !note) return;
      const text = String(content || '').trim();
      const conversation = this.normalizeConversation(note.conversation || note.content);
      if (!conversation.length && !text) return;

      let nextConversation = [...conversation];
      if (!nextConversation.length && text) {
        nextConversation.push({ role: 'user', text, created_at: new Date().toISOString() });
      } else if (this.canEditLatestUserMessage(nextConversation)) {
        if (!text) return;
        nextConversation[nextConversation.length - 1] = {
          ...nextConversation[nextConversation.length - 1],
          text,
        };
      } else if (text) {
        nextConversation.push({ role: 'user', text, created_at: new Date().toISOString() });
      }

      const previewText = this.getLatestConversationText(nextConversation);
      const { error } = await supabase
        .from(DASHBOARD_TABLE)
        .update({ content: nextConversation, preview_text: previewText })
        .eq('id', note.id);
      if (error) throw error;
      note.conversation = nextConversation;
      note.content = nextConversation;
      note.preview_text = previewText;
    }

    handleReplyInput(event) {
      const replyInput = event.target instanceof HTMLElement ? event.target.closest('.dashboard-note-reply-input') : null;
      if (!(replyInput instanceof HTMLTextAreaElement)) return;
      const noteId = replyInput.getAttribute('data-note-id');
      if (!noteId) return;
      this.replyDrafts.set(String(noteId), replyInput.value || '');
      this.scheduleReplySave(noteId);
    }

    handleReplyFocusOut(event) {
      const replyInput = event.target instanceof HTMLElement ? event.target.closest('.dashboard-note-reply-input') : null;
      if (!(replyInput instanceof HTMLTextAreaElement)) return;
      const noteId = replyInput.getAttribute('data-note-id');
      if (!noteId) return;
      this.persistReplySave(noteId).catch((error) => this.reportError('Antwort konnte nicht gespeichert werden.', error));
    }

    scheduleReplySave(noteId) {
      if (this.replySaveTimer) {
        window.clearTimeout(this.replySaveTimer);
      }
      this.replySaveTimer = window.setTimeout(() => {
        this.persistReplySave(noteId).catch((error) => this.reportError('Antwort konnte nicht gespeichert werden.', error));
      }, 450);
    }

    async persistReplySave(noteId) {
      if (this.replySaveTimer) {
        window.clearTimeout(this.replySaveTimer);
        this.replySaveTimer = null;
      }
      const draft = String(this.replyDrafts.get(String(noteId)) || '').trim();
      if (!draft) return;
      await this.saveNoteContent(noteId, draft);
      this.replyDrafts.delete(String(noteId));
      this.render();
    }

    getTodoById(todoId) {
      for (const note of this.notes) {
        const todo = (note.todos || []).find((entry) => String(entry.id) === String(todoId));
        if (todo) {
          return { note, todo };
        }
      }
      return null;
    }

    async createTodo(noteId) {
      const supabase = this.getSupabase();
      const userId = this.getUserId();
      if (!supabase || !userId) return;
      const note = this.notes.find((entry) => String(entry.id) === String(noteId));
      if (!note) return;
      const todoCount = Array.isArray(note.todos) ? note.todos.length : 0;
      if (todoCount >= EXPANDED_NOTE_TODO_MAX_ITEMS) {
        return;
      }

      const nextPosition = todoCount;
      const { data, error } = await supabase
        .from(TODOS_TABLE)
        .insert({
          note_id: note.id,
          user_id: userId,
          content: '',
          is_done: false,
          position: nextPosition,
        })
        .select('*')
        .single();
      if (error) throw error;

      note.todos = [...(note.todos || []), data];
      this.expandedNoteId = note.id;
      this.editingNoteId = note.id;
      this.render();

      window.requestAnimationFrame(() => {
        const selector = `.dashboard-note[data-note-id="${CSS.escape(String(note.id))}"] .dashboard-note-todo-item[data-todo-id="${CSS.escape(String(data.id))}"] .dashboard-note-todo-input`;
        const input = this.canvas?.querySelector(selector);
        if (input instanceof HTMLElement) {
          input.focus();
        }
      });
    }

    handleTodoInput(event) {
      const input = event.target instanceof HTMLElement ? event.target.closest('.dashboard-note-todo-input') : null;
      if (!(input instanceof HTMLElement)) return;
      const todoItem = input.closest('.dashboard-note-todo-item');
      const todoId = todoItem?.getAttribute('data-todo-id');
      if (!todoId) return;

      const pair = this.getTodoById(todoId);
      if (!pair) return;
      pair.todo.content = input.textContent || '';
      this.scheduleTodoSave(todoId);
    }

    handleTodoToggle(event) {
      const checkbox = event.target instanceof HTMLInputElement ? event.target.closest('.dashboard-note-todo-checkbox') : null;
      if (!(checkbox instanceof HTMLInputElement)) return;
      const todoItem = checkbox.closest('.dashboard-note-todo-item');
      const todoId = todoItem?.getAttribute('data-todo-id');
      if (!todoId) return;

      const pair = this.getTodoById(todoId);
      if (!pair) return;
      pair.todo.is_done = Boolean(checkbox.checked);
      this.render();
      this.persistTodoSave(todoId).catch((error) => this.reportError('To-do konnte nicht gespeichert werden.', error));
    }

    handleTodoKeyDown(event) {
      const input = event.target instanceof HTMLElement ? event.target.closest('.dashboard-note-todo-input') : null;
      if (!(input instanceof HTMLElement)) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        const noteElement = input.closest('.dashboard-note');
        const noteId = noteElement?.getAttribute('data-note-id');
        if (!noteId) return;
        this.createTodo(noteId).catch((error) => this.reportError('To-do konnte nicht erstellt werden.', error));
        return;
      }
      if (event.key !== 'Backspace') return;
      const content = String(input.textContent || '').trim();
      if (content) return;
      event.preventDefault();
      const todoItem = input.closest('.dashboard-note-todo-item');
      const todoId = todoItem?.getAttribute('data-todo-id');
      if (!todoId) return;
      this.deleteTodo(todoId).catch((error) => this.reportError('To-do konnte nicht gelöscht werden.', error));
    }

    handleTodoFocusOut(event) {
      const input = event.target instanceof HTMLElement ? event.target.closest('.dashboard-note-todo-input') : null;
      if (!(input instanceof HTMLElement)) return;
      const todoItem = input.closest('.dashboard-note-todo-item');
      const todoId = todoItem?.getAttribute('data-todo-id');
      if (!todoId) return;
      this.persistTodoSave(todoId).catch((error) => this.reportError('To-do konnte nicht gespeichert werden.', error));
    }

    handleTodoDeleteClick(event) {
      const deleteTrigger = event.target instanceof HTMLElement ? event.target.closest('[data-todo-delete="true"]') : null;
      if (!deleteTrigger) return;
      const todoItem = deleteTrigger.closest('.dashboard-note-todo-item');
      const todoId = todoItem?.getAttribute('data-todo-id');
      if (!todoId) return;
      this.deleteTodo(todoId).catch((error) => this.reportError('To-do konnte nicht gelöscht werden.', error));
    }

    async deleteTodo(todoId) {
      const pair = this.getTodoById(todoId);
      const supabase = this.getSupabase();
      if (!pair || !supabase) return;
      const { note, todo } = pair;
      const { error } = await supabase.from(TODOS_TABLE).update({
        deleted_at: new Date().toISOString(),
      }).eq('id', todo.id);
      if (error) throw error;
      note.todos = (note.todos || []).filter((entry) => String(entry.id) !== String(todo.id));
      this.render();
    }

    scheduleTodoSave(todoId) {
      const key = String(todoId);
      const existingTimer = this.todoSaveTimers.get(key);
      if (existingTimer) {
        window.clearTimeout(existingTimer);
      }
      const timerId = window.setTimeout(() => {
        this.persistTodoSave(todoId).catch((error) => this.reportError('To-do konnte nicht gespeichert werden.', error));
      }, 350);
      this.todoSaveTimers.set(key, timerId);
    }

    async persistTodoSave(todoId) {
      const key = String(todoId);
      const timerId = this.todoSaveTimers.get(key);
      if (timerId) {
        window.clearTimeout(timerId);
        this.todoSaveTimers.delete(key);
      }
      const pair = this.getTodoById(todoId);
      const supabase = this.getSupabase();
      if (!pair || !supabase) return;
      const { todo } = pair;
      const { error } = await supabase
        .from(TODOS_TABLE)
        .update({
          content: String(todo.content || ''),
          is_done: Boolean(todo.is_done),
        })
        .eq('id', todo.id);
      if (error) throw error;
    }

    normalizeNoteColor(colorValue) {
      if (colorValue === 'pink') {
        return 'red';
      }
      return NOTE_COLORS[colorValue] ? colorValue : DEFAULT_NOTE_COLOR;
    }

    async applyNoteColor(note, colorKey) {
      const supabase = this.getSupabase();
      if (!note || !NOTE_COLORS[colorKey]) return;
      note.note_color = colorKey;
      this.render();
      if (!supabase) return;
      const { error } = await supabase.from(DASHBOARD_TABLE).update({ note_color: colorKey }).eq('id', note.id);
      if (error) throw error;
    }

    escapeHtml(value) {
      return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    }

    escapeAttribute(value) {
      return this.escapeHtml(value);
    }
  }

  window.NotesDashboard = NotesDashboard;
})();
