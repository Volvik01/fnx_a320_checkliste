/**
 * FlightCabin Manager - Hauptanwendung
 * MSFS 2024 | Fenix A320 | GSX Pro Integration
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');

const db = require('./db/database');
const SimConnectService = require('./simconnect/simconnect-service');
const GsxService = require('./gsx/gsx-service');
const TtsService = require('./tts/tts-service');
const AutoAnnouncementService = require('./simconnect/auto-announcements');

const flightRoutes = require('./routes/flights');
const passengerRoutes = require('./routes/passengers');
const announcementRoutes = require('./routes/announcements');
const simbriefRoutes = require('./routes/simbrief');
const settingsRoutes = require('./routes/settings');
const { loadSettings } = require('./routes/settings');

const app = express();
const server = http.createServer(app);

// WebSocket für Echtzeit-Updates
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Services initialisieren
const simConnect = new SimConnectService(wss);
const gsxService = new GsxService(wss, simConnect);
const ttsService = new TtsService();
const autoAnn    = new AutoAnnouncementService(ttsService, wss);

// TTS-Referenz in GSX-Service setzen (für Flugnummer-Sync)
gsxService.tts = ttsService;

// ACP CAB Volume → TTS-Lautstärke
simConnect.onAcpVolume = (vol) => {
  ttsService.volume = vol;
  console.log(`[ACP→TTS] Lautstärke: ${Math.round(vol * 100)}%`);
};

// SimConnect → AutoAnnouncement koppeln
simConnect.onData = (data) => autoAnn.onSimData(data);

// GSX-Events → AutoAnnouncement
gsxService.onBoardingStart    = (p) => autoAnn.triggerBoarding(p);
gsxService.onBoardingHalfway  = ()  => autoAnn.triggerHalfway();
gsxService.onBoardingComplete = ()  => autoAnn.triggerBoardingComplete();

// Services global verfügbar machen
app.locals.simConnect = simConnect;
app.locals.gsxService = gsxService;
app.locals.ttsService = ttsService;
app.locals.autoAnn    = autoAnn;
app.locals.wss = wss;

// API-Routen
app.use('/api/flights', flightRoutes);
app.use('/api/passengers', passengerRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/simbrief', simbriefRoutes);
app.use('/api/settings', settingsRoutes);

// Status-Endpunkt
app.get('/api/status', (req, res) => {
  res.json({
    simConnected: simConnect.isConnected,
    gsxActive: gsxService.isActive,
    boardingState: gsxService.boardingState,
    currentFlight: gsxService.currentFlight,
    uptime: process.uptime()
  });
});

// WebSocket-Verbindungen verwalten
wss.on('connection', (ws) => {
  console.log('[WS] Client verbunden');

  const gsx     = gsxService;
  const flights = db.getAllFlights();

  // Aktuellen Flug: laufendes Boarding > Auto-Import > neuester Flug
  const activeFlightId = gsx.currentFlight?.id
    || app.locals.autoImportFlightId
    || (flights.length > 0 ? flights[0].id : null);

  const currentFlight = activeFlightId
    ? db.getFlightWithStats(activeFlightId)
    : null;

  const passengers = currentFlight
    ? db.getPassengers(currentFlight.id)
    : [];

  ws.send(JSON.stringify({
    type: 'FULL_STATE',
    payload: {
      simConnected:  simConnect.isConnected,
      simData:       simConnect.simData,
      boardingState: gsx.boardingState,
      boardedCount:  gsx.boardedCount,
      totalPax:      gsx.totalPax,
      progress:      gsx.totalPax > 0
        ? Math.round((gsx.boardedCount / gsx.totalPax) * 100)
        : 0,
      isActive:      gsx.isActive,
      currentFlight,
      passengers,
      flights,
      flightPhase:   autoAnn.currentPhase,
      language:      ttsService.language,
      lastOfp:       app.locals.lastOfp || null,
    }
  }));

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw);
      await handleWsMessage(msg, ws);
    } catch (err) {
      ws.send(JSON.stringify({ type: 'ERROR', payload: err.message }));
    }
  });

  ws.on('close', () => console.log('[WS] Client getrennt'));
});

async function handleWsMessage(msg, ws) {
  switch (msg.type) {
    case 'CONNECT_SIM':
      await simConnect.connect();
      break;
    case 'START_BOARDING':
      await gsxService.startBoarding(msg.payload?.flightId);
      break;
    case 'STOP_BOARDING':
      await gsxService.stopBoarding();
      break;
    case 'CHECKIN_PASSENGER':
      await gsxService.checkInPassenger(msg.payload?.passengerId);
      break;
    case 'PLAY_ANNOUNCEMENT':
      await ttsService.speak(msg.payload?.text, msg.payload?.type);
      break;
    case 'MAKE_ANNOUNCEMENT':
      const text = ttsService.getAnnouncementText(msg.payload?.key, msg.payload?.params);
      await ttsService.speak(text, 'cabin');
      broadcast(wss, { type: 'ANNOUNCEMENT_PLAYED', payload: { key: msg.payload?.key, text } });
      break;
    default:
      console.warn('[WS] Unbekannter Message-Typ:', msg.type);
  }
}

// Broadcast-Hilfsfunktion
function broadcast(wss, data) {
  const json = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  });
}

// SPA-Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Server starten
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════╗');
  console.log('║      FlightCabin Manager v1.0.0       ║');
  console.log('║   MSFS 2024 | Fenix A320 | GSX Pro    ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log('');
  console.log(`  Dashboard:     http://localhost:${PORT}`);
  console.log(`  Einstellungen: http://localhost:${PORT}/settings.html`);
  console.log('');

  // Gespeicherte Einstellungen laden und anwenden
  const saved = loadSettings();
  if (Object.keys(saved).length > 0) {
    if (saved.ttsVoice && saved.ttsVoice !== 'auto') ttsService.voice = saved.ttsVoice;
    if (saved.ttsRate)     ttsService.rate     = parseFloat(saved.ttsRate);
    if (saved.ttsVolume)   ttsService.volume   = parseFloat(saved.ttsVolume);
    if (saved.annLanguage) ttsService.language = saved.annLanguage;
    if (saved.annLanguage2) ttsService.language2 = saved.annLanguage2;
    // Bilingual: explizit Boolean — verhindert "true" als String
    ttsService.bilingual = saved.annBilingual === true;
    if (saved.simbriefId) simConnect.simbriefId = saved.simbriefId;
    console.log(`  Sprache: ${saved.annLanguage || 'de'} | Zweisprachig: ${ttsService.bilingual ? 'JA' : 'NEIN'} | SimBrief-ID: ${saved.simbriefId || '(nicht gesetzt)'}`);
    console.log('');

    // Auto-Import SimBrief OFP beim Start
    if (saved.simbriefAutoload && (saved.simbriefId || saved.simbriefUsername)) {
      setTimeout(async () => {
        try {
          const SimBriefService = require('./simbrief/simbrief-service');
          const pilotId = saved.simbriefId || saved.simbriefUsername;
          const sb = new SimBriefService(pilotId);
          console.log('[SimBrief] Auto-Import gestartet...');
          const ofp = await sb.fetchLatestOfp();

          // Flugparameter setzen
          const flightData = {
            flightNr:    ofp.flightNr    || '',
            origin:      ofp.origin      || '',
            destination: ofp.destination || '',
            originName:  ofp.originName  || '',
            destName:    ofp.destName    || '',
            aircraft:    ofp.aircraft    || 'A320',
            callsign:    ofp.callsign    || ofp.flightNr || '',
          };
          autoAnn.setFlightParams(flightData);
          ttsService.setCurrentFlight(flightData);

          // Flug in DB anlegen falls nicht vorhanden
          const db = require('./db/database');
          const today = new Date().toISOString().split('T')[0];
          const existing = db.getAllFlights().find(
            f => f.flight_nr === ofp.flightNr && f.date === today
          );

          if (!existing) {
            const { v4: uuidv4 } = require('uuid');
            const { generatePassengers } = require('./routes/simbrief');
            const flightId = uuidv4();

            db.createFlight({
              id:             flightId,
              flight_nr:      ofp.flightNr || 'AUTO',
              origin:         ofp.origin,
              destination:    ofp.destination,
              date:           today,
              seats_total:    180,
              seats_business: 12,
              seats_economy:  168,
            });

            const paxCount = ofp.paxCount || 0;
            const bizCount = Math.min(12, Math.floor(paxCount * 0.07));
            if (paxCount > 0) {
              const passengers = generatePassengers(paxCount, bizCount, flightId);
              passengers.forEach(p => db.createPassenger(p));
              console.log(`[SimBrief] Auto-Import: ${ofp.flightNr} | ${paxCount} Pax angelegt`);
            }
            app.locals.autoImportFlightId = flightId;

          } else {
            console.log(`[SimBrief] Auto-Import: Flug ${ofp.flightNr} bereits vorhanden (ID: ${existing.id})`);
            app.locals.autoImportFlightId = existing.id;

            // Passagiere anlegen falls noch keine vorhanden
            const existingPax = db.getPassengers(existing.id);
            if (existingPax.length === 0 && ofp.paxCount > 0) {
              const { generatePassengers } = require('./routes/simbrief');
              const bizCount = Math.min(12, Math.floor(ofp.paxCount * 0.07));
              const passengers = generatePassengers(ofp.paxCount, bizCount, existing.id);
              passengers.forEach(p => db.createPassenger(p));
              console.log(`[SimBrief] Passagiere nachgelegt: ${passengers.length} Pax für Flug ${ofp.flightNr}`);
            }
          }

          // OFP global speichern für spätere Clients
          app.locals.lastOfp = ofp;

          // Kurz warten bis Client stabil verbunden ist, dann informieren
          setTimeout(() => {
            const json = JSON.stringify({
              type: 'SIMBRIEF_AUTO_IMPORTED',
              payload: { ofp, flightData, flightId: app.locals.autoImportFlightId }
            });
            wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(json); });
          }, 2000);

        } catch (err) {
          console.warn('[SimBrief] Auto-Import fehlgeschlagen:', err.message);
        }
      }, 3000); // 3s nach Start
    }
  }

  // Auto-connect versuchen
  setTimeout(() => simConnect.connect().catch(() => {}), 2000);
});

module.exports = { app, server, wss, broadcast };
