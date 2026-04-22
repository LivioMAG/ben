const CONFIG_PATH = '../supabase-config.json';
const DEFAULT_DURATION_HOURS = 2;
const DEFAULT_SEARCH_START = '07:00';
const DEFAULT_SEARCH_END = '16:30';
const SEARCH_STEP_MINUTES = 30;
const SEARCH_MAX_DAYS = 180;
const SEARCH_MAX_RESULTS = 200;
const ALLOWED_ROLE_PARTS = ['monteur', 'service', 'elektroinstallateur'];

const state = {
  supabase: null,
  user: null,
  properties: [],
  selectedProperty: null,
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
  setDefaultSearchDate();
  try {
    await initializeSupabase();
    await preloadProperties();
    setStatus('Seite bereit. Bitte Immobilie, Dauer und Suchrahmen erfassen.', false);
  } catch (error) {
    setStatus(`Initialisierung fehlgeschlagen: ${error.message}`, true);
  }
}

function setDefaultSearchDate() {
  if (!elements.searchDate) return;
  const today = new Date();
  const defaultDate = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
  elements.searchDate.value = defaultDate;
  if (elements.searchStartTime) elements.searchStartTime.value = DEFAULT_SEARCH_START;
  if (elements.searchEndTime) elements.searchEndTime.value = DEFAULT_SEARCH_END;
}

function cacheElements() {
  elements.form = document.getElementById('bookingForm');
  elements.propertySearch = document.getElementById('propertySearch');
  elements.propertyResults = document.getElementById('propertyResults');
  elements.propertySelectionInfo = document.getElementById('propertySelectionInfo');
  elements.description = document.getElementById('description');
  elements.slotDuration = document.getElementById('slotDuration');
  elements.searchDate = document.getElementById('searchDate');
  elements.searchStartTime = document.getElementById('searchStartTime');
  elements.searchEndTime = document.getElementById('searchEndTime');
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

async function handleSubmit(event) {
  event.preventDefault();
  if (state.isSubmitting) return;

  try {
    setSubmitting(true);
    setStatus('Prüfe Verfügbarkeiten…', false);
    hideResult();
    hideAvailability();

    const payload = collectAndValidateForm();
    const matches = await findAvailabilitySuggestions(payload);
    state.pendingPayload = payload;
    state.availabilityOptions = matches;
    state.availabilityOffset = 0;

    if (!matches.length) {
      setStatus('Für die Suchkriterien wurden keine verfügbaren Termine gefunden.', true);
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

  const searchDate = String(elements.searchDate?.value || '').trim();
  if (!searchDate) {
    throw new Error('Bitte ein Startdatum für die Suche festlegen.');
  }

  const searchStart = String(elements.searchStartTime?.value || '').trim();
  const searchEnd = String(elements.searchEndTime?.value || '').trim();
  if (!searchStart || !searchEnd) {
    throw new Error('Bitte den Suchrahmen mit Start- und Endzeit eintragen.');
  }
  if (searchStart >= searchEnd) {
    throw new Error('Der Suchrahmen ist ungültig: "von" muss vor "bis" liegen.');
  }

  const durationMinutes = Math.round(durationHours * 60);
  if (durationMinutes > diffMinutes(searchStart, searchEnd)) {
    throw new Error('Die Dauer passt nicht in den gewählten Suchrahmen.');
  }

  return {
    property: state.selectedProperty,
    description,
    durationHours,
    durationMinutes,
    searchDate,
    searchStart,
    searchEnd,
  };
}

async function findAvailabilitySuggestions(payload) {
  const technicians = await loadTechnicians();
  if (!technicians.length) return [];

  const searchDates = buildSearchDates(payload.searchDate, SEARCH_MAX_DAYS);
  const minDate = searchDates[0];
  const maxDate = searchDates[searchDates.length - 1];
  const technicianIds = technicians.map((technician) => technician.id);

  const [assignments, absences, holidays] = await Promise.all([
    loadAssignments(technicianIds, minDate, maxDate),
    loadAbsences(technicianIds, minDate, maxDate),
    loadPlatformHolidays(searchDates),
  ]);

  const matches = [];
  const durationMinutes = payload.durationMinutes;

  for (const date of searchDates) {
    if (matches.length >= SEARCH_MAX_RESULTS) break;
    if (holidays.has(date)) {
      continue;
    }

    const daySlots = buildDaySlots(date, payload.searchStart, payload.searchEnd, durationMinutes);
    for (const slot of daySlots) {
      if (matches.length >= SEARCH_MAX_RESULTS) break;
      const matchedTechnician = technicians.find((technician) => {
        const hasAbsence = absences.some((absence) => absence.profile_id === technician.id && slot.date >= absence.start_date && slot.date <= absence.end_date);
        if (hasAbsence) return false;

        const hasOverlap = assignments.some((assignment) => {
          if (assignment.profile_id !== technician.id || assignment.assignment_date !== slot.date) {
            return false;
          }
          const assignmentStartMinutes = timeToMinutes(assignment.start_time);
          const assignmentEndMinutes = timeToMinutes(assignment.end_time);
          const slotStartMinutes = timeToMinutes(slot.start);
          const slotEndMinutes = timeToMinutes(slot.end);
          return assignmentStartMinutes < slotEndMinutes && assignmentEndMinutes > slotStartMinutes;
        });
        return !hasOverlap;
      });

      if (matchedTechnician) {
        matches.push({ slot, technician: matchedTechnician });
      }
    }
  }

  return matches;
}

function buildSearchDates(startDateIso, days) {
  const startDate = parseIsoDate(startDateIso);
  const dates = [];
  for (let i = 0; i < days; i += 1) {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + i);
    dates.push(formatIsoDate(date));
  }
  return dates;
}

function buildDaySlots(date, searchStart, searchEnd, durationMinutes) {
  const slots = [];
  const searchStartMinutes = timeToMinutes(searchStart);
  const searchEndMinutes = timeToMinutes(searchEnd);
  for (let start = searchStartMinutes; start + durationMinutes <= searchEndMinutes; start += SEARCH_STEP_MINUTES) {
    slots.push({
      date,
      start: minutesToTime(start),
      end: minutesToTime(start + durationMinutes),
    });
  }
  return slots;
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

async function loadAssignments(profileIds, minDate, maxDate) {
  const { data, error } = await state.supabase
    .from('daily_assignments')
    .select('profile_id,assignment_date,start_time,end_time')
    .in('profile_id', profileIds)
    .gte('assignment_date', minDate)
    .lte('assignment_date', maxDate);
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
      <button type="button" data-action="book-option" data-option-index="${optionIndex}">Buchen</button>
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
    setStatus(`Buchung erfolgreich erstellt. Auftragsnummer: ${bookingResult.project.commission_number}`, false);
  } catch (error) {
    setStatus(`Fehler: ${error.message}`, true);
  } finally {
    setSubmitting(false);
  }
}

function setSubmitting(isSubmitting) {
  state.isSubmitting = isSubmitting;
  elements.submitButton.disabled = isSubmitting;
  elements.searchDate.disabled = isSubmitting;
  elements.searchStartTime.disabled = isSubmitting;
  elements.searchEndTime.disabled = isSubmitting;
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

function formatDate(dateValue) {
  const [year, month, day] = dateValue.split('-').map(Number);
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
}

function diffMinutes(startTime, endTime) {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
}

function timeToMinutes(timeValue) {
  const [hourPart, minutePart] = String(timeValue).split(':').map(Number);
  return hourPart * 60 + minutePart;
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function parseIsoDate(isoDate) {
  const [year, month, day] = String(isoDate).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatIsoDate(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
