(function () {
  const DASHBOARD_TABLE = 'dashboard_notes';
  const ATTACHMENTS_TABLE = 'dashboard_note_attachments';
  const STORAGE_BUCKET = 'dashboard-note-attachments';
  const GRID_SIZE = 8;
  const DEFAULT_NOTE_WIDTH = 168;
  const DEFAULT_NOTE_HEIGHT = 120;
  const CARD_PREVIEW_MAX_LENGTH = 80;
  const LONG_PRESS_DELAY_MS = 520;
  const LONG_HOVER_DELAY_MS = 3000;
  const DRAG_START_THRESHOLD_PX = 6;

  class NotesDashboard {
    constructor(options) {
      this.options = options || {};
      this.root = this.options.root || null;
      this.canvas = this.options.canvas || null;
      this.actionBar = this.options.actionBar || null;
      this.modal = this.options.modal || null;
      this.modalTextarea = this.options.modalTextarea || null;
      this.modalAttachments = this.options.modalAttachments || null;
      this.modalFileInput = this.options.modalFileInput || null;
      this.modalSaveButton = this.options.modalSaveButton || null;
      this.modalDeleteButton = this.options.modalDeleteButton || null;
      this.modalCloseButton = this.options.modalCloseButton || null;

      this.notes = [];
      this.activeNoteId = null;
      this.dragState = null;
      this.pressState = null;
      this.isSaving = false;
      this.editingNoteId = null;
      this.hoverState = null;
      this.expandedNoteId = null;
      this.inlineSaveTimer = null;
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
      this.canvas.addEventListener('dblclick', (event) => this.handleNoteDoubleClick(event));
      this.canvas.addEventListener('pointerover', (event) => this.handleCanvasPointerOver(event));
      this.canvas.addEventListener('pointerout', (event) => this.handleCanvasPointerOut(event));
      this.canvas.addEventListener('input', (event) => this.handleInlineEditorInput(event));
      this.canvas.addEventListener('focusout', (event) => this.handleInlineEditorFocusOut(event));

      if (this.modalTextarea) {
        this.modalTextarea.addEventListener('input', () => this.handleModalInput());
      }
      if (this.modalSaveButton) {
        this.modalSaveButton.addEventListener('click', () => this.saveActiveNoteFromModal());
      }
      if (this.modalDeleteButton) {
        this.modalDeleteButton.addEventListener('click', () => this.deleteActiveNote());
      }
      if (this.modalCloseButton) {
        this.modalCloseButton.addEventListener('click', () => this.closeModal());
      }
      if (this.modalFileInput) {
        this.modalFileInput.addEventListener('change', (event) => this.handleAttachmentUpload(event));
      }
      window.addEventListener('resize', this.boundResize);
    }

    destroy() {
      window.removeEventListener('resize', this.boundResize);
      this.clearPressState();
      this.clearHoverState();
      if (this.inlineSaveTimer) {
        window.clearTimeout(this.inlineSaveTimer);
        this.inlineSaveTimer = null;
      }
    }

    async refresh() {
      const supabase = this.getSupabase();
      const userId = this.getUserId();
      if (!supabase || !userId || !this.canvas) return;

      try {
        const [{ data: notes, error: notesError }, { data: attachments, error: attachmentsError }] = await Promise.all([
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
        ]);

        if (notesError) throw notesError;
        if (attachmentsError) throw attachmentsError;

        this.notes = (notes || []).map((note) => ({
          ...note,
          attachments: (attachments || []).filter((attachment) => String(attachment.note_id) === String(note.id)),
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
      this.clearHoverState();
      this.render();
      this.hideActionBar();
      this.closeModal();
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
          content: '',
          pos_x: normalized.posX,
          pos_y: normalized.posY,
          width: normalized.width,
          height: normalized.height,
        })
        .select('*')
        .single();

      if (error) throw error;

      this.notes.push({ ...data, attachments: [] });
      this.activeNoteId = data.id;
      this.render();
      this.openModal(data.id);
    }

    handleCanvasPointerDown(event) {
      const note = event.target instanceof HTMLElement ? event.target.closest('.dashboard-note') : null;
      if (!note) {
        this.clearSelection();
        return;
      }

      const noteId = note.dataset.noteId;
      const active = this.notes.find((entry) => String(entry.id) === String(noteId));
      if (!active) return;

      this.activeNoteId = active.id;
      this.pressState = {
        pointerId: event.pointerId,
        noteId: active.id,
        noteElement: note,
        startClientX: event.clientX,
        startClientY: event.clientY,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      this.pressState.timerId = window.setTimeout(() => this.handleLongPress(event.pointerId), LONG_PRESS_DELAY_MS);
      note.setPointerCapture(event.pointerId);
      this.bindDragListeners();
      this.render();
    }

    handleNoteDoubleClick(event) {
      const note = event.target instanceof HTMLElement ? event.target.closest('.dashboard-note') : null;
      if (!note) return;
      const noteId = note.dataset.noteId;
      if (!noteId) return;
      this.openModal(noteId);
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
      this.clearPressState();
      this.unbindDragListeners();
      if (!longPressTriggered) {
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
      this.showActionBar();
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

    openModal(noteId) {
      if (!this.modal) return;
      this.activeNoteId = noteId;
      this.modal.classList.remove('hidden');
      this.renderModal();
      if (this.modalTextarea) {
        this.modalTextarea.focus();
      }
    }

    closeModal() {
      if (!this.modal) return;
      this.modal.classList.add('hidden');
    }

    handleCanvasPointerOver(event) {
      const note = event.target instanceof HTMLElement ? event.target.closest('.dashboard-note') : null;
      if (!note || event.pointerType === 'touch') return;
      const related = event.relatedTarget instanceof HTMLElement ? event.relatedTarget.closest('.dashboard-note') : null;
      if (related && related.dataset.noteId === note.dataset.noteId) return;
      const noteId = note.dataset.noteId;
      if (!noteId) return;
      this.clearHoverState();
      this.hoverState = { noteId };
      this.hoverState.timerId = window.setTimeout(() => {
        if (!this.hoverState || String(this.hoverState.noteId) !== String(noteId)) return;
        this.expandedNoteId = noteId;
        this.render();
      }, LONG_HOVER_DELAY_MS);
    }

    handleCanvasPointerOut(event) {
      const sourceNote = event.target instanceof HTMLElement ? event.target.closest('.dashboard-note') : null;
      if (!sourceNote) return;
      const related = event.relatedTarget instanceof HTMLElement ? event.relatedTarget.closest('.dashboard-note') : null;
      if (related && related.dataset.noteId === sourceNote.dataset.noteId) return;
      const noteId = sourceNote.dataset.noteId;
      if (this.hoverState && String(this.hoverState.noteId) === String(noteId)) {
        this.clearHoverState();
      }
      if (String(this.expandedNoteId) === String(noteId)) {
        this.expandedNoteId = null;
        this.render();
      }
    }

    clearHoverState() {
      if (this.hoverState?.timerId) {
        window.clearTimeout(this.hoverState.timerId);
      }
      this.hoverState = null;
    }

    getActiveNote() {
      return this.notes.find((entry) => String(entry.id) === String(this.activeNoteId));
    }

    renderModal() {
      const activeNote = this.getActiveNote();
      if (!activeNote) return;
      if (this.modalTextarea && this.modalTextarea !== document.activeElement) {
        this.modalTextarea.value = activeNote.content || '';
      }

      if (this.modalAttachments) {
        if (!activeNote.attachments?.length) {
          this.modalAttachments.innerHTML = '<li class="subtle-text">Keine Anhänge.</li>';
        } else {
          this.modalAttachments.innerHTML = activeNote.attachments.map((attachment) => {
            const url = this.getAttachmentUrl(attachment);
            const name = this.escapeHtml(attachment.file_name || 'Anhang');
            if (!url) {
              return `<li>${name}</li>`;
            }
            return `<li><a href="${this.escapeAttribute(url)}" target="_blank" rel="noopener">${name}</a></li>`;
          }).join('');
        }
      }
    }

    handleModalInput() {
      const activeNote = this.getActiveNote();
      if (!activeNote || !this.modalTextarea) return;
      activeNote.content = String(this.modalTextarea.value || '');
      this.render();
    }

    async saveActiveNoteFromModal() {
      const note = this.getActiveNote();
      const supabase = this.getSupabase();
      if (!note || !supabase || this.isSaving) return;
      this.isSaving = true;
      try {
        const content = String(this.modalTextarea?.value || '');
        await this.saveNoteContent(note.id, content);
        this.render();
        this.closeModal();
      } catch (error) {
        this.reportError('Notiz konnte nicht gespeichert werden.', error);
      } finally {
        this.isSaving = false;
      }
    }

    async deleteActiveNote() {
      const note = this.getActiveNote();
      if (!note) return;
      await this.deleteNoteById(note.id);
      this.closeModal();
      this.hideActionBar();
    }

    async deleteNoteById(noteId) {
      const supabase = this.getSupabase();
      if (!supabase) return;
      const deletedAt = new Date().toISOString();
      await Promise.all([
        supabase.from(DASHBOARD_TABLE).update({ deleted_at: deletedAt }).eq('id', noteId),
        supabase.from(ATTACHMENTS_TABLE).update({ deleted_at: deletedAt }).eq('note_id', noteId),
      ]);
      this.notes = this.notes.filter((entry) => String(entry.id) !== String(noteId));
      if (String(this.activeNoteId) === String(noteId)) {
        this.activeNoteId = null;
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

      if (this.modalFileInput) {
        this.modalFileInput.value = '';
      }
      this.render();
      this.renderModal();
    }

    getAttachmentUrl(attachment) {
      const supabase = this.getSupabase();
      if (!supabase || !attachment?.file_path) return '';
      const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(attachment.file_path);
      return data?.publicUrl || '';
    }

    normalizeAllPositions() {
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

    handleViewportResize() {
      if (!this.notes.length) return;
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
      this.hideActionBar();
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
      if (!this.notes.length) {
        this.canvas.innerHTML = '<div class="dashboard-note-empty subtle-text">Doppelklick zum Erstellen einer Notiz.</div>';
        return;
      }

      this.canvas.innerHTML = this.notes.map((note) => {
        const content = String(note.content || '');
        const isExpanded = String(this.expandedNoteId) === String(note.id);
        const isEditing = String(this.editingNoteId) === String(note.id);
        const preview = this.getPreviewText(content, isExpanded || isEditing);
        const attachmentCount = Array.isArray(note.attachments) ? note.attachments.length : 0;
        return `
          <article
            class="dashboard-note ${String(this.activeNoteId) === String(note.id) ? 'active' : ''} ${isExpanded ? 'is-expanded' : ''} ${isEditing ? 'is-editing' : ''}"
            data-note-id="${this.escapeAttribute(note.id)}"
            style="left:${Number(note.pos_x || 0)}px; top:${Number(note.pos_y || 0)}px; width:${Number(note.width || DEFAULT_NOTE_WIDTH)}px; height:${Number(note.height || DEFAULT_NOTE_HEIGHT)}px;"
          >
            <div class="dashboard-note-content" contenteditable="${isEditing ? 'true' : 'false'}" spellcheck="true">${this.escapeHtml(preview || ' ')}</div>
            <footer class="dashboard-note-footer">
              <span>${isEditing ? 'Bearbeiten…' : 'Kurzansicht'}</span>
              <span>📎 ${attachmentCount}</span>
            </footer>
          </article>
        `;
      }).join('');
      this.focusInlineEditorIfNeeded();
    }

    getPreviewText(content, showFullText) {
      if (showFullText || content.length <= CARD_PREVIEW_MAX_LENGTH) {
        return content;
      }
      return `${content.slice(0, CARD_PREVIEW_MAX_LENGTH)}...`;
    }

    focusInlineEditorIfNeeded() {
      if (!this.canvas || !this.editingNoteId) return;
      const editor = this.canvas.querySelector(`.dashboard-note[data-note-id="${CSS.escape(String(this.editingNoteId))}"] .dashboard-note-content`);
      if (!(editor instanceof HTMLElement)) return;
      editor.focus();
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
      this.editingNoteId = noteId;
      this.hideActionBar();
      this.render();
    }

    handleInlineEditorInput(event) {
      const contentEl = event.target instanceof HTMLElement ? event.target.closest('.dashboard-note-content') : null;
      if (!contentEl) return;
      const noteElement = contentEl.closest('.dashboard-note');
      const noteId = noteElement?.dataset.noteId;
      const note = this.notes.find((entry) => String(entry.id) === String(noteId));
      if (!note) return;
      note.content = contentEl.textContent || '';
      this.scheduleInlineSave(note.id);
    }

    handleInlineEditorFocusOut(event) {
      const contentEl = event.target instanceof HTMLElement ? event.target.closest('.dashboard-note-content') : null;
      if (!contentEl) return;
      const noteElement = contentEl.closest('.dashboard-note');
      const noteId = noteElement?.dataset.noteId;
      if (!noteId) return;
      this.persistInlineSave(noteId).catch((error) => this.reportError('Notiz konnte nicht gespeichert werden.', error));
      this.editingNoteId = null;
      this.render();
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
      await this.saveNoteContent(note.id, note.content || '');
      this.render();
    }

    async saveNoteContent(noteId, content) {
      const supabase = this.getSupabase();
      const note = this.notes.find((entry) => String(entry.id) === String(noteId));
      if (!supabase || !note) return;
      note.content = String(content || '');
      const { error } = await supabase.from(DASHBOARD_TABLE).update({ content: note.content }).eq('id', note.id);
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
