/**
 * Condor Cabin Manager — Frontend
 * GSX-gesteuerte Pax-Zahlen, zufälliger Sitzplan
 */

// ─── State ──────────────────────────────────────────────
const state = {
  ws:              null,
  currentFlightId: null,
  flights:         [],
  passengers:      [],
  simData:         {},
  boardingActive:  false,
  totalPax:        0,
  boardedPax:      0,
  // Sitzplan-Belegung: seat → status ('free'|'boarded'|'business')
  seatMap:         {},
};

// ─── WebSocket ──────────────────────────────────────────
function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  state.ws = new WebSocket(`${proto}//${location.host}`);
  state.ws.onopen    = () => console.log('[WS] Verbunden');
  state.ws.onmessage = (evt) => { try { handleMessage(JSON.parse(evt.data)); } catch(e){} };
  state.ws.onclose   = () => setTimeout(connectWS, 3000);
}

function send(type, payload = {}) {
  if (state.ws?.readyState === WebSocket.OPEN)
    state.ws.send(JSON.stringify({ type, payload }));
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'FULL_STATE':      onFullState(msg.payload); break;
    case 'SIM_CONNECTED':    setSimStatus(true, msg.payload.name); break;
    case 'SIM_DISCONNECTED': setSimStatus(false); break;
    case 'SIM_DATA':         updateSimData(msg.payload); break;
    case 'FLIGHT_PHASE':     updatePhase(msg.payload.phase); break;

    case 'BOARDING_STARTED':  onBoardingStarted(msg.payload); break;
    case 'BOARDING_PROGRESS': onBoardingProgress(msg.payload); break;
    case 'BOARDING_COMPLETE': onBoardingComplete(msg.payload); break;

    case 'GSX_BOARDING_STATE': updateGsxState(msg.payload.state, msg.payload.name); break;
    case 'GSX_PAX_COUNTS':     onGsxPaxCounts(msg.payload); break;
    case 'ACP_CAB_VOLUME':     updateCabVolume(msg.payload); break;

    case 'ANNOUNCEMENT_PLAYED': showAnnouncementFeedback(msg.payload?.key); break;
    case 'SIMBRIEF_AUTO_IMPORTED': onSimbriefAutoImported(msg.payload); break;
  }
}

// Kompletten State beim Connect wiederherstellen
async function onFullState(payload) {
  if (payload.simConnected) setSimStatus(true);
  if (payload.simData && Object.keys(payload.simData).length) updateSimData(payload.simData);
  if (payload.flightPhase) updatePhase(payload.flightPhase);

  // SimBrief-Info anzeigen falls vorhanden
  if (payload.lastOfp) showSimbriefInfo(payload.lastOfp);

  // Flüge laden
  if (payload.flights?.length) {
    state.flights = payload.flights;
    renderFlightList(payload.flights);
  }

  // Aktuellen Flug wiederherstellen
  if (payload.currentFlight) {
    const f = payload.currentFlight;
    state.currentFlightId = f.id;
    state.passengers      = payload.passengers || [];

    // Pax-Zahl: totalPax > pax_count > Passagierlänge
    state.totalPax = payload.totalPax || f.pax_count || state.passengers.length || 0;

    const badge = el('flight-badge');
    if (badge) {
      badge.textContent = `${f.flight_nr}: ${f.origin} → ${f.destination}`;
      badge.classList.add('active');
    }

    set('stat-total',     state.totalPax);
    set('stat-remaining', state.totalPax);
    set('stat-boarded',   '0');
    set('stat-progress',  '0%');
    setW('boarding-progress', '0%');

    renderFlightList(state.flights);
    renderPassengers(state.passengers);
    initSeatmap(state.passengers, state.totalPax);
  }

  // Boarding-State wiederherstellen
  if (payload.boardingState === 'BOARDING' || payload.isActive) {
    state.boardingActive = true;
    const sb = el('start-boarding-btn'); if (sb) sb.disabled = true;
    const eb = el('stop-boarding-btn');  if (eb) eb.disabled = false;
    const badge = el('boarding-badge');
    if (badge) { badge.textContent = 'BOARDING'; badge.className = 'boarding-state-badge BOARDING'; }
    onBoardingProgress({
      boardedCount: payload.boardedCount || 0,
      totalPax:     payload.totalPax     || 0,
      progress:     payload.progress     || 0,
    });
  } else if (payload.boardingState === 'COMPLETE') {
    const badge = el('boarding-badge');
    if (badge) { badge.textContent = 'COMPLETE'; badge.className = 'boarding-state-badge COMPLETE'; }
    const total = payload.totalPax || state.totalPax;
    set('stat-boarded',   total);
    set('stat-remaining', '0');
    set('stat-progress',  '100%');
    setW('boarding-progress', '100%');
    // Sitzplan initialisieren und voll füllen
    if (!state._occupiedEconomy || state._occupiedEconomy.length === 0) {
      initSeatmap(state.passengers, total);
    }
    updateSeatmapBoarded(total, total);
  }
}

// ─── SimConnect ──────────────────────────────────────────
function connectSim() {
  send('CONNECT_SIM');
  const btn = el('connect-btn');
  btn.textContent = 'Verbinde...';
  btn.disabled = true;
}

function setSimStatus(connected, name = '') {
  const dot = el('sim-dot');
  const btn = el('connect-btn');
  if (connected) {
    dot.className = 'dot connected';
    btn.textContent = 'Verbunden ✓';
    btn.disabled = true;
  } else {
    dot.className = 'dot';
    btn.textContent = 'Mit MSFS verbinden';
    btn.disabled = false;
  }
}

function updateSimData(data) {
  state.simData = data;
  el('sim-ground').textContent = data.onGround ? '🟢 Am Boden' : '✈️ In der Luft';
  el('sim-speed').textContent  = `${data.airspeed || 0} kts`;
  el('sim-alt').textContent    = `${(data.altitude||0).toLocaleString()} ft`;
  el('sim-brake').textContent  = data.parkingBrake ? 'An' : 'Aus';
}

function updateCabVolume(payload) {
  const pct = payload.pct || Math.round((payload.volume || 0) * 100);
  set('cab-volume-pct', pct + '%');
  setW('cab-volume-bar', pct + '%');
}

function updatePhase(phase) {
  const badge = el('phase-badge');
  if (!badge) return;
  badge.textContent = phase;
  badge.className   = 'phase-badge ' + phase;
}

function updateGsxState(state, name) {
  const dot  = el('gsx-dot');
  const hint = document.querySelector('.gsx-hint');
  if (dot) dot.className = (state === 3) ? 'dot connected' : 'dot';
  if (hint) {
    const labels = {
      0: 'GSX Pro: nicht verfügbar',
      1: 'GSX Pro: bereit',
      2: 'GSX Pro: angefordert',
      3: 'GSX Pro: Boarding läuft ✓',
      4: 'GSX Pro: Boarding abgeschlossen',
      5: 'GSX Pro: übersprungen',
      6: 'GSX Pro: deaktiviert',
    };
    hint.textContent = labels[state] || `GSX Pro: ${name}`;
    hint.style.color = state === 3 ? 'var(--green)' : state === 4 ? 'var(--amber)' : '';
  }
}

function onGsxPaxCounts(payload) {
  if (!state.boardingActive && payload.target > 0) {
    state.totalPax = payload.target;
    set('stat-total', payload.target);
  }
}

// ─── Flüge ───────────────────────────────────────────────
async function loadFlights() {
  const flights = await api('/api/flights');
  state.flights = flights;
  renderFlightList(flights);
  if (flights.length > 0 && !state.currentFlightId) {
    selectFlight(flights[0].id);
  }
}

function renderFlightList(flights) {
  const list = el('flights-list');
  if (!list) return; // Element nicht im DOM (kompaktes Layout)
  if (!flights.length) { list.innerHTML = '<div class="empty-state">Keine Flüge</div>'; return; }
  list.innerHTML = flights.map(f => `
    <div class="flight-item ${f.id === state.currentFlightId ? 'selected' : ''}"
         onclick="selectFlight('${f.id}')">
      <div class="flight-item-nr">${f.flight_nr}</div>
      <div class="flight-item-route">${f.origin} → ${f.destination}</div>
      <div class="flight-item-route">${f.date} · ${f.pax_count || 0} Pax</div>
      <span class="flight-item-status status-${f.status}">${f.status}</span>
    </div>
  `).join('');
}

async function selectFlight(flightId) {
  state.currentFlightId = flightId;
  const data = await api(`/api/flights/${flightId}`);
  state.passengers = data.passengers || [];

  const badge = el('flight-badge');
  if (badge) { badge.textContent = `${data.flight_nr}: ${data.origin} → ${data.destination}`; badge.classList.add('active'); }

  const total = data.pax_count || state.passengers.length;
  state.totalPax = total;
  set('stat-total',     total);
  set('stat-boarded',   '0');
  set('stat-remaining', total);
  set('stat-progress',  '0%');
  setW('boarding-progress', '0%');

  renderFlightList(state.flights);
  renderPassengers(state.passengers);
  initSeatmap(data.passengers, total);
}

// ─── Boarding ────────────────────────────────────────────
function startBoarding() {
  if (!state.currentFlightId) { alert('Bitte zuerst einen Flug auswählen'); return; }
  send('START_BOARDING', { flightId: state.currentFlightId });
}
function stopBoarding() { send('STOP_BOARDING'); }

function onBoardingStarted(payload) {
  state.boardingActive = true;
  const startBtn = el('start-boarding-btn');
  const stopBtn  = el('stop-boarding-btn');
  if (startBtn) startBtn.disabled = true;
  if (stopBtn)  stopBtn.disabled  = false;

  const badge = el('boarding-badge');
  if (badge) { badge.textContent = 'BOARDING'; badge.className = 'boarding-state-badge BOARDING'; }

  const total = payload.totalPax || state.totalPax;
  if (total > 0) {
    state.totalPax = total;
    set('stat-total',     total);
    set('stat-remaining', total);
  }
  set('stat-boarded',  '0');
  set('stat-progress', '0%');
  setW('boarding-progress', '0%');
  initSeatmap(state.passengers, total);
  setTimeout(loadFlights, 1000);
}

function onBoardingProgress(payload) {
  const { boardedCount, totalPax, progress } = payload;
  state.boardedPax = boardedCount;
  if (totalPax > 0) state.totalPax = totalPax;

  const pct = progress ?? Math.round((boardedCount / (state.totalPax||1)) * 100);
  const rem = Math.max(0, state.totalPax - boardedCount);

  set('stat-boarded',   boardedCount);
  set('stat-total',     state.totalPax);
  set('stat-remaining', rem);
  set('stat-progress',  pct + '%');
  setW('boarding-progress', pct + '%');

  updateSeatmapBoarded(boardedCount, state.totalPax);
}

function onBoardingComplete(payload) {
  state.boardingActive = false;
  const startBtn = el('start-boarding-btn');
  const stopBtn  = el('stop-boarding-btn');
  if (startBtn) startBtn.disabled = false;
  if (stopBtn)  stopBtn.disabled  = true;

  const badge = el('boarding-badge');
  if (badge) { badge.textContent = 'COMPLETE'; badge.className = 'boarding-state-badge COMPLETE'; }

  const total = payload.totalPax || state.totalPax;
  set('stat-boarded',   total);
  set('stat-remaining', '0');
  set('stat-progress',  '100%');
  setW('boarding-progress', '100%');

  // Sitzplan erst initialisieren falls noch nicht geschehen, dann voll füllen
  if (!state._occupiedEconomy || state._occupiedEconomy.length === 0) {
    initSeatmap(state.passengers, total);
  }
  updateSeatmapBoarded(total, total);

  setTimeout(loadFlights, 1000);
}

// ─── Sitzplan ────────────────────────────────────────────
// A320: Reihen 1-2 Business (12 Sitze), 3-30 Economy (168 Sitze)
const BUSINESS_ROWS = [1, 2];
const ALL_COLS = ['A','B','C','D','E','F'];

function getAllSeats() {
  const seats = [];
  for (let r = 1; r <= 30; r++) {
    for (const c of ALL_COLS) {
      seats.push(`${r}${c}`);
    }
  }
  return seats;
}

function initSeatmap(passengers, totalPax) {
  // Sitze aus Passagierliste + zufällige Verteilung für GSX-Pax
  state.seatMap = {};
  const allSeats = getAllSeats();

  // Business-Sitze immer belegen (Reihe 1-2)
  const businessSeats = allSeats.filter(s => BUSINESS_ROWS.includes(parseInt(s)));
  businessSeats.forEach(s => state.seatMap[s] = 'business');

  // Economy-Sitze zufällig vorbelegen basierend auf totalPax
  const economySeats = allSeats.filter(s => !BUSINESS_ROWS.includes(parseInt(s)));
  // Shuffle
  for (let i = economySeats.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [economySeats[i], economySeats[j]] = [economySeats[j], economySeats[i]];
  }
  // Die belegten Economy-Sitze merken (= totalPax - 12 Business)
  const econPax = Math.max(0, (totalPax || 0) - businessSeats.length);
  state._occupiedEconomy = economySeats.slice(0, econPax);
  state._freeEconomy     = economySeats.slice(econPax);

  // Alle als frei starten
  state._occupiedEconomy.forEach(s => state.seatMap[s] = 'free');
  state._freeEconomy.forEach(s => state.seatMap[s] = 'empty_seat');

  renderSeatmap();
}

function updateSeatmapBoarded(boarded, total) {
  if (!state._occupiedEconomy) return;

  // Wie viele Economy-Sitze sind geboardet?
  const businessCount = 12;
  const econBoarded   = Math.max(0, boarded - Math.min(boarded, businessCount));
  const toBoard       = Math.round((boarded / total) * state._occupiedEconomy.length);

  // Business immer geboardet wenn Boarding läuft
  const businessSeats = getAllSeats().filter(s => BUSINESS_ROWS.includes(parseInt(s)));
  if (boarded > 0) businessSeats.forEach(s => state.seatMap[s] = 'boarded');

  // Economy zufällig füllen bis toBoard
  state._occupiedEconomy.forEach((s, i) => {
    state.seatMap[s] = i < toBoard ? 'boarded' : 'free';
  });

  renderSeatmap();
}

function renderSeatmap() {
  const seatmap = el('seatmap');
  let html = '';

  for (let row = 1; row <= 30; row++) {
    html += `<div class="seat-row"><span class="seat-row-label">${row}</span>`;
    ['A','B','C'].forEach(col => {
      const key = `${row}${col}`;
      const cls = getSeatCls(key, row);
      html += `<div class="seat ${cls}" title="${key}"></div>`;
    });
    html += `<div class="seat-gap"></div>`;
    ['D','E','F'].forEach(col => {
      const key = `${row}${col}`;
      const cls = getSeatCls(key, row);
      html += `<div class="seat ${cls}" title="${key}"></div>`;
    });
    html += '</div>';
  }
  seatmap.innerHTML = html;
}

function getSeatCls(key, row) {
  const status = state.seatMap[key];
  if (!status || status === 'empty_seat') return 'free'; // nicht belegter Sitz
  if (status === 'boarded')  return 'boarded';
  if (status === 'business') return BUSINESS_ROWS.includes(row) ? 'business' : 'free';
  return 'free';
}

// ─── Passagierliste ──────────────────────────────────────
function renderPassengers(passengers, filter = '') {
  const list = el('passengers-list');
  let shown = passengers;
  if (filter) {
    const q = filter.toLowerCase();
    shown = passengers.filter(p =>
      p.first_name?.toLowerCase().includes(q) ||
      p.last_name?.toLowerCase().includes(q)  ||
      (p.seat||'').toLowerCase().includes(q)
    );
  }
  if (!shown.length) {
    list.innerHTML = '<div class="empty-state">Keine Passagiere</div>';
    return;
  }
  list.innerHTML = shown.map(p => `
    <div class="pax-row ${p.boarded ? 'boarded' : ''}">
      <div class="pax-seat">${p.seat || '—'}</div>
      <div class="pax-name">${p.last_name}, ${p.first_name}</div>
      <span class="pax-class ${p.seat_class}">${p.seat_class === 'BUSINESS' ? 'BIZ' : 'ECO'}</span>
    </div>
  `).join('');
}

function filterPassengers(value) {
  renderPassengers(state.passengers, value);
}

// ─── Ansagen ─────────────────────────────────────────────
async function playAnnouncement(key) {
  const flight = state.flights.find(f => f.id === state.currentFlightId);
  const params = flight ? { flightNr: flight.flight_nr, destination: flight.destination, origin: flight.origin } : {};
  await api('/api/announcements/play', 'POST', { key, params, flightId: state.currentFlightId });
  showAnnouncementFeedback(key);
}

async function playCustom() {
  const input = el('custom-text');
  const text = input?.value?.trim();
  if (!text) return;
  await api('/api/announcements/custom', 'POST', { text, flightId: state.currentFlightId });
  if (input) input.value = '';
}

async function stopAnnouncement() { await api('/api/announcements/stop', 'POST'); }

function showAnnouncementFeedback(key) {
  document.querySelectorAll('.ann-btn').forEach(btn => {
    btn.classList.remove('playing');
    if (btn.onclick?.toString().includes(`'${key}'`)) {
      btn.classList.add('playing');
      setTimeout(() => btn.classList.remove('playing'), 2000);
    }
  });
}

async function toggleAutoAnn(enabled) {
  await api('/api/announcements/auto', 'POST', { enabled });
}

async function onSimbriefAutoImported(payload) {
  const { ofp, flightId } = payload;
  console.log('[SimBrief] Auto-Import:', ofp?.flightNr, flightId);
  showSimbriefInfo(ofp);
  await loadFlights();
  // Flug direkt auswählen
  if (flightId) {
    await selectFlight(flightId);
  }
}

// ─── SimBrief ────────────────────────────────────────────
async function importSimbrief() {
  const btn = el('simbrief-btn');
  btn.textContent = '⏳ Lade OFP...';
  btn.disabled = true;

  try {
    const result = await api('/api/simbrief/import', 'POST', {});

    if (!result.success && result.error === 'Flug bereits importiert') {
      showSimbriefInfo(result.ofp);
      if (result.existingId) { await loadFlights(); selectFlight(result.existingId); }
      btn.textContent = '✓ Bereits importiert';
      setTimeout(() => { btn.textContent = '⬇ OFP importieren'; btn.disabled = false; }, 3000);
      return;
    }
    if (!result.success) throw new Error(result.error);

    showSimbriefInfo(result.ofp);
    await loadFlights();
    selectFlight(result.flightId);
    btn.textContent = `✓ ${result.flight?.origin}→${result.flight?.destination} (${result.passengersCreated} Pax)`;
    setTimeout(() => { btn.textContent = '⬇ OFP importieren'; btn.disabled = false; }, 4000);

  } catch (err) {
    btn.textContent = '✗ Fehler – Retry';
    btn.disabled = false;
    setTimeout(() => { btn.textContent = '⬇ OFP importieren'; }, 4000);
    alert(`SimBrief Fehler: ${err.message}`);
  }
}

function showSimbriefInfo(ofp) {
  if (!ofp) return;
  const panel = el('simbrief-info');
  const fmtTime = ts => ts ? new Date(parseInt(ts)*1000).toISOString().substring(11,16)+'z' : '—';
  const fmtDur  = s  => s  ? `${Math.floor(s/3600)}h ${String(Math.floor((s%3600)/60)).padStart(2,'0')}m` : '—';
  panel.style.display = 'block';
  panel.innerHTML = `
    <div class="simbrief-row"><span>Flug</span><span>${ofp.flightNr||'—'}</span></div>
    <div class="simbrief-row"><span>Route</span><span>${ofp.origin} → ${ofp.destination}</span></div>
    <div class="simbrief-row"><span>Abflug</span><span>${fmtTime(ofp.etd)}</span></div>
    <div class="simbrief-row"><span>Ankunft</span><span>${fmtTime(ofp.eta)}</span></div>
    <div class="simbrief-row"><span>Flugzeit</span><span>${fmtDur(ofp.enroute)}</span></div>
    <div class="simbrief-row"><span>Passagiere</span><span>${ofp.paxCount||0}</span></div>
    <div class="simbrief-row"><span>ZFW</span><span>${ofp.zfw ? Math.round(ofp.zfw/1000*10)/10+'t' : '—'}</span></div>
    ${ofp.route ? `<div class="simbrief-route">${ofp.route.substring(0,120)}${ofp.route.length>120?'…':''}</div>` : ''}
  `;
}

// ─── Neuer Flug ──────────────────────────────────────────
function showNewFlightModal() {
  el('f-date').value = new Date().toISOString().split('T')[0];
  el('new-flight-modal').classList.add('active');
}
function closeModal(e) {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('active');
}
async function createFlight() {
  const nr = el('f-nr').value.trim(), origin = el('f-origin').value.trim();
  const dest = el('f-dest').value.trim(), date = el('f-date').value;
  if (!nr || !origin || !dest || !date) { alert('Bitte alle Felder ausfüllen'); return; }
  await api('/api/flights', 'POST', {
    flightNr: nr.toUpperCase(), origin: origin.toUpperCase(),
    destination: dest.toUpperCase(), date
  });
  el('new-flight-modal').classList.remove('active');
  await loadFlights();
}

// ─── Hilfsfunktionen ────────────────────────────────────
// Defensiv — gibt null zurück wenn Element nicht existiert (kein Crash)
function el(id) { return document.getElementById(id); }
function set(id, val) { const e = el(id); if (e) e.textContent = val; }
function setW(id, val) { const e = el(id); if (e) e.style.width = val; }

async function api(path, method = 'GET', body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  return res.json();
}

// ─── Init ────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  connectWS();
  loadFlights();
});
