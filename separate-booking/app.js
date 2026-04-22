const CONFIG_PATH = '../supabase-config.json';
const DEFAULT_SLOT_START = '08:00';
const DEFAULT_DURATION_HOURS = 2;
const ALLOWED_ROLE_PARTS = ['monteur', 'service', 'elektroinstallateur'];

const state = {
  supabase: null,
  user: null,
  properties: [],
  selectedProperty: null,
  slots: [],
  availabilityOptions: [],
  availabilityOffset: 0,
  pendingPayload: null,
  isSubmitting: false,
};

const elements = {};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  cacheElements();
  bindEvents();
  addSlotRow();
  try {
    await initializeSupabase();
    await preloadProperties();
    setStatus('Seite bereit. Bitte Immobilie auswählen und Zeitfenster erfassen.', false);
  } catch (error) {
    setStatus(`Initialisierung fehlgeschlagen: ${error.message}`, true);
  }
}

function cacheElements() {
  elements.form = document.getElementById('bookingForm');
  elements.propertySearch = document.getElementById('propertySearch');
  elements.propertyResults = document.getElementById('propertyResults');
  elements.propertySelectionInfo = document.getElementById('propertySelectionInfo');
  elements.description = document.getElementById('description');
  elements.slotDuration = document.getElementById('slotDuration');
  elements.addSlotButton = document.getElementById('addSlotButton');
  elements.slotsContainer = document.getElementById('slotsContainer');
  elements.submitButton = document.getElementById('submitButton');
  elements.availabilityCard = document.getElementById('availabilityCard');
  elements.availabilityInfo = document.getElementById('availabilityInfo');
  elements.availabilityList = document.getElementById('availabilityList');
  elements.loadMoreButton = document.getElementById('loadMoreButton');
  elements.statusCard = document.getElementById('statusCard');
  elements.statusMessage = document.getElementById('statusMessage');
  elements.resultCard = document.getElementById('resultCard');
  elements.resultProperty = document.getElementById('resultProperty');
  elements.resultSlot = document.getElementById('resultSlot');
  elements.resultTechnician = document.getElementById('resultTechnician');
  elements.resultOrder = document.getElementById('resultOrder');
}

function bindEvents() {
  elements.form?.addEventListener('submit', handleSubmit);
  elements.propertySearch?.addEventListener('input', handlePropertyInput);
  elements.propertySearch?.addEventListener('focus', handlePropertyInput);
  document.addEventListener('click', (event) => {
    if (!elements.propertyResults.contains(event.target) && event.target !== elements.propertySearch) {
      clearPropertySuggestions();
    }
  });

  elements.addSlotButton?.addEventListener('click', () => addSlotRow());
  elements.slotsContainer?.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-action="remove-slot"]');
    if (!removeButton) return;
    const slotId = removeButton.getAttribute('data-slot-id');
    removeSlotRow(slotId);
  });

  elements.slotsContainer?.addEventListener('change', (event) => {
    const row = event.target.closest('[data-slot-id]');
    if (!row) return;
    const slotId = row.getAttribute('data-slot-id');
    if (event.target.matches('[data-field="start"]')) {
      updateSlotEndByDuration(slotId);
    }
  });

  elements.slotDuration?.addEventListener('change', () => {
    state.slots.forEach((slot) => updateSlotEndByDuration(slot.id));
  });

  elements.loadMoreButton?.addEventListener('click', () => renderMoreAvailability());
}

async function initializeSupabase() {
  const configResponse = await fetch(CONFIG_PATH, { cache: 'no-store' });
  if (!configResponse.ok) {
    throw new Error('supabase-config.json konnte nicht geladen werden.');
  }
  const config = await configResponse.json();
  state.supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  const { data: sessionData, error } = await state.supabase.auth.getSession();
  if (error) throw error;
  state.user = sessionData?.session?.user || null;
}

async function preloadProperties() {
  const { data, error } = await state.supabase
    .from('properties')
    .select('id,name,strasse,postleitzahl,ort')
    .order('name', { ascending: true })
    .limit(250);
  if (error) throw error;
  state.properties = data || [];
}

function handlePropertyInput() {
  const searchValue = String(elements.propertySearch.value || '').trim().toLowerCase();
  if (!searchValue) {
    state.selectedProperty = null;
    elements.propertySelectionInfo.textContent = '';
    clearPropertySuggestions();
    return;
  }

  const filtered = state.properties
    .filter((property) => {
      const haystack = [property.name, property.strasse, property.postleitzahl, property.ort]
        .join(' ')
        .toLowerCase();
      return haystack.includes(searchValue);
    })
    .slice(0, 10);

  renderPropertySuggestions(filtered);
}

function renderPropertySuggestions(properties) {
  if (!properties.length) {
    elements.propertyResults.innerHTML = '<div class="hint">Keine passende Immobilie gefunden.</div>';
    return;
  }

  elements.propertyResults.innerHTML = properties
    .map((property) => {
      const label = propertyLabel(property);
      return `<button type="button" class="autocomplete-item" data-property-id="${escapeHtml(property.id)}">${escapeHtml(label)}</button>`;
    })
    .join('');

  elements.propertyResults.querySelectorAll('[data-property-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const propertyId = button.getAttribute('data-property-id');
      const selected = state.properties.find((property) => property.id === propertyId);
      if (!selected) return;
      selectProperty(selected);
      clearPropertySuggestions();
    });
  });
}

function selectProperty(property) {
  state.selectedProperty = property;
  elements.propertySearch.value = propertyLabel(property);
  elements.propertySelectionInfo.textContent = `Ausgewählt: ${propertyLabel(property)}`;
}

function clearPropertySuggestions() {
  elements.propertyResults.innerHTML = '';
}

function addSlotRow(slot = {}) {
  const slotId = crypto.randomUUID();
  const today = new Date();
  const defaultDate = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
  state.slots.push({ id: slotId });

  const row = document.createElement('div');
  row.className = 'slot-row';
  row.setAttribute('data-slot-id', slotId);
  row.innerHTML = `
    <input type="date" data-field="date" value="${slot.date || defaultDate}" required />
    <input type="time" data-field="start" value="${slot.start || DEFAULT_SLOT_START}" required />
    <input type="time" data-field="end" value="${slot.end || ''}" required />
    <button type="button" class="remove" data-action="remove-slot" data-slot-id="${slotId}">Entfernen</button>
  `;

  elements.slotsContainer.appendChild(row);
  updateSlotEndByDuration(slotId, { force: !slot.end });
}

function removeSlotRow(slotId) {
  if (state.slots.length <= 1) {
    setStatus('Mindestens ein Zeitfenster muss vorhanden bleiben.', true);
    return;
  }

  state.slots = state.slots.filter((slot) => slot.id !== slotId);
  const row = elements.slotsContainer.querySelector(`[data-slot-id="${slotId}"]`);
  row?.remove();
}

function updateSlotEndByDuration(slotId, options = {}) {
  const row = elements.slotsContainer.querySelector(`[data-slot-id="${slotId}"]`);
  if (!row) return;
  const startInput = row.querySelector('[data-field="start"]');
  const endInput = row.querySelector('[data-field="end"]');
  if (!startInput || !endInput) return;
  const durationHours = parseFloat(elements.slotDuration.value || String(DEFAULT_DURATION_HOURS));
  if (!startInput.value || !Number.isFinite(durationHours) || durationHours <= 0) return;
  if (endInput.value && !options.force) return;
  endInput.value = addHoursToTime(startInput.value, durationHours);
}

async function handleSubmit(event) {
  event.preventDefault();
  if (state.isSubmitting) return;

  try {
    setSubmitting(true);
    setStatus('Prüfe Verfügbarkeiten…', false);
    hideResult();
    hideAvailability();

    const payload = collectAndValidateForm();
    const matches = await findAvailableTechnicians(payload.slots);
    state.pendingPayload = payload;
    state.availabilityOptions = matches;
    state.availabilityOffset = 0;

    if (!matches.length) {
      setStatus('Für die angegebenen Zeitfenster wurde kein verfügbarer Monteur gefunden.', true);
      return;
    }

    renderMoreAvailability({ reset: true });
    setStatus('Verfügbarkeiten geladen. Bitte einen Termin auswählen.', false);
  } catch (error) {
    setStatus(`Fehler: ${error.message}`, true);
  } finally {
    setSubmitting(false);
  }
}

function collectAndValidateForm() {
  if (!state.selectedProperty?.id) {
    throw new Error('Bitte zuerst eine gültige Immobilie aus der Trefferliste auswählen.');
  }

  const description = String(elements.description.value || '').trim();
  if (!description) {
    throw new Error('Bitte eine Beschreibung / Hinweistext eintragen.');
  }

  const durationHours = parseFloat(elements.slotDuration.value || String(DEFAULT_DURATION_HOURS));
  if (!Number.isFinite(durationHours) || durationHours <= 0) {
    throw new Error('Die Dauer des Zeitfensters muss größer als 0 sein.');
  }

  const slotRows = [...elements.slotsContainer.querySelectorAll('[data-slot-id]')];
  const slots = slotRows.map((row, index) => {
    const dateInput = row.querySelector('[data-field="date"]');
    const startInput = row.querySelector('[data-field="start"]');
    const endInput = row.querySelector('[data-field="end"]');
    if (!dateInput || !startInput || !endInput) {
      throw new Error(`Zeitfenster ${index + 1} ist beschädigt. Bitte Zeile entfernen und neu anlegen.`);
    }
    const date = dateInput.value;
    const start = startInput.value;
    const end = endInput.value;
    if (!date || !start || !end) {
      throw new Error(`Zeitfenster ${index + 1} ist unvollständig.`);
    }
    if (start >= end) {
      throw new Error(`Zeitfenster ${index + 1} ist ungültig: Ende muss nach Start liegen.`);
    }
    return { index, date, start, end };
  });

  if (!slots.length) {
    throw new Error('Bitte mindestens ein Zeitfenster erfassen.');
  }

  return {
    property: state.selectedProperty,
    description,
    durationHours,
    slots,
  };
}

async function findAvailableTechnicians(slots) {
  const technicians = await loadTechnicians();
  if (!technicians.length) return [];

  const uniqueDates = [...new Set(slots.map((slot) => slot.date))].sort();
  const minDate = uniqueDates[0];
  const maxDate = uniqueDates[uniqueDates.length - 1];

  const [assignments, absences, holidays] = await Promise.all([
    loadAssignments(technicians.map((technician) => technician.id), uniqueDates),
    loadAbsences(technicians.map((technician) => technician.id), minDate, maxDate),
    loadPlatformHolidays(uniqueDates),
  ]);

  const matches = [];
  const sortedSlots = [...slots].sort(compareSlotDateTime);

  for (const slot of sortedSlots) {
    if (holidays.has(slot.date)) {
      continue;
    }
    for (const technician of technicians) {
      const hasAbsence = absences.some((absence) => absence.profile_id === technician.id && slot.date >= absence.start_date && slot.date <= absence.end_date);
      if (hasAbsence) continue;

      const hasOverlap = assignments.some((assignment) => {
        if (assignment.profile_id !== technician.id || assignment.assignment_date !== slot.date) {
          return false;
        }
        return assignment.start_time < slot.end && assignment.end_time > slot.start;
      });

      if (!hasOverlap) {
        matches.push({ slot, technician });
      }
    }
  }

  return matches;
}

async function loadTechnicians() {
  const { data, error } = await state.supabase
    .from('app_profiles')
    .select('id,full_name,role_label,is_active,is_admin')
    .eq('is_active', true)
    .order('full_name', { ascending: true });
  if (error) throw error;

  return (data || []).filter((profile) => {
    if (profile.is_admin) return false;
    const role = String(profile.role_label || '').toLowerCase();
    return ALLOWED_ROLE_PARTS.some((part) => role.includes(part));
  });
}

async function loadAssignments(profileIds, dates) {
  const { data, error } = await state.supabase
    .from('daily_assignments')
    .select('profile_id,assignment_date,start_time,end_time')
    .in('profile_id', profileIds)
    .in('assignment_date', dates);
  if (error) throw error;
  return data || [];
}

async function loadAbsences(profileIds, minDate, maxDate) {
  const { data, error } = await state.supabase
    .from('holiday_requests')
    .select('profile_id,start_date,end_date,controll_pl,controll_gl')
    .in('profile_id', profileIds)
    .lte('start_date', maxDate)
    .gte('end_date', minDate)
    .or('controll_pl.not.is.null,controll_gl.not.is.null');
  if (error) throw error;
  return data || [];
}

async function loadPlatformHolidays(dates) {
  const { data, error } = await state.supabase
    .from('platform_holidays')
    .select('holiday_date')
    .in('holiday_date', dates);
  if (error) throw error;
  return new Set((data || []).map((entry) => entry.holiday_date));
}

async function createBooking(payload, match) {
  const cleanup = [];

  try {
    const projectInsert = await state.supabase
      .from('projects')
      .insert({
        commission_number: await generateCommissionNumber(),
        name: `Serviceauftrag · ${payload.property.name}`,
        property_id: payload.property.id,
        budget: 0,
      })
      .select('id,name,commission_number')
      .single();
    if (projectInsert.error) throw projectInsert.error;
    const project = projectInsert.data;
    cleanup.push(async () => {
      await state.supabase.from('projects').delete().eq('id', project.id);
    });

    const senderId = state.user?.id || null;
    if (!senderId) {
      throw new Error('Kein aktiver Benutzer gefunden. Bitte zuerst anmelden.');
    }

    const noteInsert = await state.supabase.from('notes').insert({
      target_uid: project.id,
      note_type: 'project',
      note_text: payload.description,
      sender_uid: senderId,
      note_category: 'information',
      requires_response: false,
    });
    if (noteInsert.error) throw noteInsert.error;
    cleanup.push(async () => {
      await state.supabase.from('notes').delete().eq('target_uid', project.id).eq('note_type', 'project');
    });

    const assignmentInsert = await state.supabase.from('daily_assignments').insert({
      profile_id: match.technician.id,
      assignment_date: match.slot.date,
      start_time: match.slot.start,
      end_time: match.slot.end,
      project_id: project.id,
      label: `Service · ${payload.property.name}`,
      source: 'separate_booking',
    });
    if (assignmentInsert.error) throw assignmentInsert.error;
    cleanup.push(async () => {
      await state.supabase
        .from('daily_assignments')
        .delete()
        .eq('project_id', project.id)
        .eq('profile_id', match.technician.id)
        .eq('assignment_date', match.slot.date)
        .eq('start_time', match.slot.start)
        .eq('end_time', match.slot.end);
    });

    const kanbanInsert = await state.supabase.from('project_kanban_notes').insert({
      project_id: project.id,
      status: 'todo',
      position: 0,
      note_type: 'text',
      title: 'Automatisch angelegt',
      content: payload.description,
    });
    if (kanbanInsert.error) throw kanbanInsert.error;

    return {
      property: payload.property,
      slot: match.slot,
      technician: match.technician,
      project,
    };
  } catch (error) {
    for (const undo of cleanup.reverse()) {
      try {
        await undo();
      } catch (cleanupError) {
        console.warn('Rollback fehlgeschlagen', cleanupError);
      }
    }
    throw error;
  }
}

async function generateCommissionNumber() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const random = Math.floor(Math.random() * 900 + 100);
  return `AUTO-${stamp}-${random}`;
}

function showResult(result) {
  elements.resultProperty.textContent = propertyLabel(result.property);
  elements.resultSlot.textContent = `${formatDate(result.slot.date)} · ${result.slot.start}–${result.slot.end}`;
  elements.resultTechnician.textContent = result.technician.full_name;
  elements.resultOrder.textContent = `${result.project.name} (${result.project.commission_number})`;
  elements.resultCard.classList.remove('hidden');
}

function hideResult() {
  elements.resultCard.classList.add('hidden');
}

function hideAvailability() {
  elements.availabilityCard.classList.add('hidden');
  elements.availabilityList.innerHTML = '';
  elements.loadMoreButton.classList.add('hidden');
}

function renderMoreAvailability(options = {}) {
  const shouldReset = Boolean(options.reset);
  if (shouldReset) {
    elements.availabilityList.innerHTML = '';
    state.availabilityOffset = 0;
  }

  const pageSize = 10;
  const nextOptions = state.availabilityOptions.slice(state.availabilityOffset, state.availabilityOffset + pageSize);
  if (!nextOptions.length) return;

  const fragment = document.createDocumentFragment();
  nextOptions.forEach((option, index) => {
    const optionIndex = state.availabilityOffset + index;
    const card = document.createElement('article');
    card.className = 'availability-item';
    card.innerHTML = `
      <div>
        <strong>Option ${optionIndex + 1}: ${formatDate(option.slot.date)} · ${option.slot.start}–${option.slot.end}</strong>
        <p class="availability-item-meta">Monteur: ${escapeHtml(option.technician.full_name)}</p>
      </div>
      <button type="button" data-action="book-option" data-option-index="${optionIndex}">Diesen Termin wählen</button>
    `;
    fragment.appendChild(card);
  });

  elements.availabilityList.appendChild(fragment);
  elements.availabilityCard.classList.remove('hidden');

  state.availabilityOffset += nextOptions.length;
  const hasMore = state.availabilityOffset < state.availabilityOptions.length;
  elements.loadMoreButton.classList.toggle('hidden', !hasMore);
  elements.availabilityInfo.textContent = hasMore
    ? `${state.availabilityOffset} von ${state.availabilityOptions.length} Terminen angezeigt.`
    : `${state.availabilityOptions.length} Termine verfügbar.`;

  elements.availabilityList.querySelectorAll('[data-action="book-option"]').forEach((button) => {
    if (button.dataset.bound === '1') return;
    button.dataset.bound = '1';
    button.addEventListener('click', handleBookOption);
  });
}

async function handleBookOption(event) {
  const optionIndex = Number(event.currentTarget.getAttribute('data-option-index'));
  const match = state.availabilityOptions[optionIndex];
  if (!match || !state.pendingPayload || state.isSubmitting) return;

  try {
    setSubmitting(true);
    setStatus('Lege Auftrag für gewählten Termin an…', false);
    const bookingResult = await createBooking(state.pendingPayload, match);
    showResult(bookingResult);
    setStatus('Buchung erfolgreich erstellt und eingeplant.', false);
  } catch (error) {
    setStatus(`Fehler: ${error.message}`, true);
  } finally {
    setSubmitting(false);
  }
}

function setSubmitting(isSubmitting) {
  state.isSubmitting = isSubmitting;
  elements.submitButton.disabled = isSubmitting;
  elements.addSlotButton.disabled = isSubmitting;
  elements.loadMoreButton.disabled = isSubmitting;
  elements.availabilityList.querySelectorAll('[data-action="book-option"]').forEach((button) => {
    button.disabled = isSubmitting;
  });
}

function setStatus(message, isError) {
  elements.statusCard.classList.remove('hidden');
  elements.statusMessage.textContent = message;
  elements.statusMessage.classList.toggle('status-error', Boolean(isError));
  elements.statusMessage.classList.toggle('status-success', !isError);
}

function propertyLabel(property) {
  return `${property.name} · ${property.strasse}, ${property.postleitzahl} ${property.ort}`;
}

function addHoursToTime(timeValue, hoursToAdd) {
  const [hourPart, minutePart] = timeValue.split(':').map(Number);
  const startMinutes = hourPart * 60 + minutePart;
  const nextMinutes = (startMinutes + Math.round(hoursToAdd * 60)) % (24 * 60);
  const hours = Math.floor(nextMinutes / 60);
  const minutes = nextMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatDate(dateValue) {
  const [year, month, day] = dateValue.split('-').map(Number);
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
}

function compareSlotDateTime(a, b) {
  const dateCompare = a.date.localeCompare(b.date);
  if (dateCompare !== 0) return dateCompare;
  const startCompare = a.start.localeCompare(b.start);
  if (startCompare !== 0) return startCompare;
  return a.end.localeCompare(b.end);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
