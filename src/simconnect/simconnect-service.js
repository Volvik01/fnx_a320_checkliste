/**
 * SimConnect Service — node-simconnect 4.x
 *
 * WICHTIG: Fenix A320 + GSX Pro Auto-Ablauf funktioniert anders als erwartet:
 * - FSDT_GSX_BOARDING_STATE bleibt auf BYPASSED(5) während dem Boarding
 * - Das echte Boarding erkennt man an FSDT_GSX_NUMPASSENGERS_BOARDING (steigt 0→169)
 * - Boarding-Start = wenn NUMPASSENGERS_BOARDING von 0 auf > 0 springt
 * - Boarding-Ende  = wenn NUMPASSENGERS_BOARDING >= NUMPASSENGERS (Ziel erreicht)
 */

const WebSocket = require('ws');

const GSX_STATE = {
  0:'UNAVAILABLE', 1:'AVAILABLE', 2:'REQUESTED',
  3:'PERFORMING',  4:'COMPLETED', 5:'BYPASSED', 6:'DISABLED'
};

const DEF_SIM = 1; const REQ_SIM = 1;
const BASE_GSX = 200; // Basis-ID für einzelne LVAR-Requests

const MOCK_SEQUENCE = [
  { onGround:true,  airspeed:0,   altitude:162,  parkingBrake:true,  verticalSpeed:0    },
  { onGround:true,  airspeed:0,   altitude:162,  parkingBrake:false, verticalSpeed:0    },
  { onGround:true,  airspeed:18,  altitude:162,  parkingBrake:false, verticalSpeed:0    },
  { onGround:false, airspeed:165, altitude:2000, parkingBrake:false, verticalSpeed:2000 },
  { onGround:false, airspeed:260, altitude:33000,parkingBrake:false, verticalSpeed:80   },
  { onGround:false, airspeed:250, altitude:20000,parkingBrake:false, verticalSpeed:-900 },
  { onGround:false, airspeed:190, altitude:3500, parkingBrake:false, verticalSpeed:-700 },
  { onGround:true,  airspeed:8,   altitude:162,  parkingBrake:false, verticalSpeed:0    },
  { onGround:true,  airspeed:0,   altitude:162,  parkingBrake:true,  verticalSpeed:0    },
];

// GSX LVARs die wir überwachen
const GSX_LVARS = [
  'FSDT_GSX_BOARDING_STATE',               // 0
  'FSDT_GSX_DEBOARDING_STATE',             // 1
  'FSDT_GSX_NUMPASSENGERS',               // 2 — Ziel-Pax (aus SimBrief)
  'FSDT_GSX_NUMPASSENGERS_BOARDING_TOTAL', // 3 — aktuell boardende Pax (steigt während Boarding)
  'FSDT_GSX_NUMPASSENGERS_BOARDING',       // 4 — gleich wie TOTAL bei Fenix
  'FSDT_GSX_BOARDING_PAX_PCT',            // 5 — Prozent (oft 0 bei Fenix)
];

class SimConnectService {
  constructor(wss) {
    this.wss          = wss;
    this.isConnected  = false;
    this.simData      = {};
    this.onData       = null;
    this.onGsxEvent   = null;
    this._handle      = null;
    this._mockMode    = false;
    this._mockTimer   = null;
    this._reconnectTimer = null;

    // GSX State-Tracking
    this._gsxBoarding        = -1;
    this._gsxDeboarding      = -1;
    this._prevPaxBoarding    = 0;    // vorheriger NUMPASSENGERS_BOARDING Wert
    this._gsxTotalPax        = 0;    // Ziel-Pax von GSX
    this._halfwaySent        = false;
    this._boardingStartSent  = false;
    this._boardingCompleteSent = false;

    // LVAR-Werte Cache
    this._lvarValues = {};

    try {
      this._sc = require('node-simconnect');
      console.log('[SimConnect] node-simconnect geladen ✓');
    } catch (e) {
      this._sc = null;
      console.warn('[SimConnect] node-simconnect fehlt → Mock-Modus');
      console.warn('[SimConnect] Installieren: npm install node-simconnect');
    }
  }

  async connect() {
    if (this._sc) await this._connectReal();
    else this._startMock();
  }

  async _connectReal() {
    try {
      console.log('[SimConnect] Verbinde mit MSFS 2024...');
      const { open, Protocol } = this._sc;
      const { recvOpen, handle } = await open('Condor Cabin Manager', Protocol.KittyHawk);

      this._handle     = handle;
      this.isConnected = true;
      this._mockMode   = false;

      console.log(`[SimConnect] ✓ ${recvOpen.applicationName}`);
      this._broadcast({ type: 'SIM_CONNECTED', payload: { name: recvOpen.applicationName } });

      this._setupSimVars();
      this._setupGsxLvars();
      this._setupAcpLvars();

      handle.on('exception', () => {}); // LVARs werfen Exceptions bis GSX aktiv ist — ignorieren
      handle.on('quit',  () => this._onDisconnect('MSFS beendet'));
      handle.on('error', () => this._onDisconnect('Fehler'));
      handle.on('close', () => this._onDisconnect('Geschlossen'));

    } catch (err) {
      this._reconnectTimer = setTimeout(() => this._connectReal(), 5000);
    }
  }

  _onDisconnect(reason) {
    console.log(`[SimConnect] Getrennt: ${reason}`);
    this.isConnected = false;
    this._handle     = null;
    this._broadcast({ type: 'SIM_DISCONNECTED', payload: {} });
    this._reconnectTimer = setTimeout(() => this._connectReal(), 5000);
  }

  // ── Standard SimVars ──────────────────────────────────────
  _setupSimVars() {
    const h = this._handle;
    const { SimConnectDataType, SimConnectPeriod, SimConnectConstants } = this._sc;

    h.addToDataDefinition(DEF_SIM, 'SIM ON GROUND',          null,              SimConnectDataType.INT32);
    h.addToDataDefinition(DEF_SIM, 'AIRSPEED INDICATED',     'knots',           SimConnectDataType.FLOAT64);
    h.addToDataDefinition(DEF_SIM, 'INDICATED ALTITUDE',     'feet',            SimConnectDataType.FLOAT64);
    h.addToDataDefinition(DEF_SIM, 'BRAKE PARKING POSITION', null,              SimConnectDataType.INT32);
    h.addToDataDefinition(DEF_SIM, 'VERTICAL SPEED',         'feet per minute', SimConnectDataType.FLOAT64);

    h.requestDataOnSimObject(REQ_SIM, DEF_SIM, SimConnectConstants.OBJECT_ID_USER, SimConnectPeriod.SECOND);

    h.on('simObjectData', (recv) => {
      if (recv.requestID === REQ_SIM) {
        const d = recv.data;
        this.simData = {
          onGround:      d.readInt32()    === 1,
          airspeed:      Math.round(d.readFloat64()),
          altitude:      Math.round(d.readFloat64()),
          parkingBrake:  d.readInt32()    === 1,
          verticalSpeed: Math.round(d.readFloat64()),
        };
        this._broadcast({ type: 'SIM_DATA', payload: this.simData });
        if (this.onData) this.onData(this.simData);
      }
    });
  }

  // ── Fenix ACP CAB Volume ──────────────────────────────────
  // A_ASP3_CAB_VOLUME: 0.0 (stumm) bis 1.0 (max)
  // Wird direkt als TTS-Lautstärke übernommen
  _setupAcpLvars() {
    const h = this._handle;
    const { SimConnectDataType, SimConnectPeriod, SimConnectConstants } = this._sc;

    const DEF_ACP = 50;
    const REQ_ACP = 50;

    try {
      h.addToDataDefinition(DEF_ACP, 'L:A_ASP3_CAB_VOLUME', 'number', SimConnectDataType.FLOAT64);
      h.requestDataOnSimObject(DEF_ACP, REQ_ACP, SimConnectConstants.OBJECT_ID_USER, SimConnectPeriod.SECOND);

      this._prevCabVol = -1;

      h.on('simObjectData', (recv) => {
        if (recv.requestID !== REQ_ACP) return;
        try {
          const vol = parseFloat(recv.data.readFloat64().toFixed(3));
          if (vol !== this._prevCabVol) {
            this._prevCabVol = vol;
            console.log(`[ACP] CAB Volume: ${Math.round(vol * 100)}%`);

            // TTS-Lautstärke setzen (0.0–1.0)
            if (this.onAcpVolume) this.onAcpVolume(vol);

            // Dashboard informieren
            this._broadcast({
              type: 'ACP_CAB_VOLUME',
              payload: { volume: vol, pct: Math.round(vol * 100) }
            });
          }
        } catch(e) {}
      });

      console.log('[ACP] CAB Volume LVAR registriert (A_ASP3_CAB_VOLUME) ✓');
    } catch(e) {
      console.warn('[ACP] LVAR konnte nicht registriert werden:', e.message);
    }
  }
  // So funktioniert es zuverlässig auch wenn GSX erst nach der App startet
  _setupGsxLvars() {
    const h = this._handle;
    const { SimConnectDataType, SimConnectPeriod, SimConnectConstants } = this._sc;

    console.log('[GSX] Registriere LVARs...');

    GSX_LVARS.forEach((lvar, i) => {
      const id = BASE_GSX + i;
      this._lvarValues[i] = 0;
      try {
        h.addToDataDefinition(id, `L:${lvar}`, 'number', SimConnectDataType.FLOAT64);
        h.requestDataOnSimObject(id, id, SimConnectConstants.OBJECT_ID_USER, SimConnectPeriod.SECOND);
      } catch (e) {}
    });

    h.on('simObjectData', (recv) => {
      const idx = recv.requestID - BASE_GSX;
      if (idx < 0 || idx >= GSX_LVARS.length) return;
      try {
        const val = Math.round(recv.data.readFloat64());
        this._lvarValues[idx] = val;
        this._processGsxLvars();
      } catch (e) {}
    });

    console.log('[GSX] LVARs registriert ✓ — warte auf GSX-Aktivität');
  }

  // ── GSX-Daten auswerten ───────────────────────────────────
  _processGsxLvars() {
    const boarding         = this._lvarValues[0]; // BOARDING_STATE
    const deboarding       = this._lvarValues[1]; // DEBOARDING_STATE
    const paxTarget        = this._lvarValues[2]; // NUMPASSENGERS (Ziel)
    const paxBoardingTotal = this._lvarValues[3]; // NUMPASSENGERS_BOARDING_TOTAL
    const paxBoarding      = this._lvarValues[4]; // NUMPASSENGERS_BOARDING
    const paxPct           = this._lvarValues[5]; // BOARDING_PAX_PCT

    // Ziel-Pax merken
    if (paxTarget > 0) this._gsxTotalPax = paxTarget;

    // ══ BOARDING-ERKENNUNG ═══════════════════════════════════
    // Fenix+GSX: Boarding läuft wenn NUMPASSENGERS_BOARDING > 0
    // und war vorher 0 → das ist der Boarding-Start

    const currentPax = paxBoardingTotal > 0 ? paxBoardingTotal : paxBoarding;

    if (currentPax > 0 && this._prevPaxBoarding === 0 && !this._boardingStartSent) {
      // BOARDING START
      this._boardingStartSent   = true;
      this._boardingCompleteSent = false;
      this._halfwaySent         = false;
      console.log(`[GSX] ★ BOARDING START erkannt! Pax boardend: ${currentPax}, Ziel: ${this._gsxTotalPax}`);
      this._broadcast({ type: 'GSX_BOARDING_STATE', payload: { state: 3, name: 'PERFORMING' } });
      if (this.onGsxEvent) {
        this.onGsxEvent('BOARDING_START', {
          paxTarget:        this._gsxTotalPax,
          paxBoardingTotal: currentPax,
        });
      }
    }

    // Fortschritt
    if (currentPax !== this._prevPaxBoarding && currentPax > 0) {
      const total = this._gsxTotalPax || 169;
      const pct   = Math.round((currentPax / total) * 100);

      // Fortschritt an GSX-Service melden
      if (this.onGsxEvent) {
        this.onGsxEvent('BOARDING_PROGRESS', {
          boarded: currentPax,
          total:   this._gsxTotalPax,
          pct,
        });
      }

      this._broadcast({
        type: 'GSX_PAX_COUNTS',
        payload: { target: total, boardingTotal: currentPax, pct }
      });

      // Halbzeit
      if (pct >= 48 && pct <= 55 && !this._halfwaySent && this.onGsxEvent) {
        this._halfwaySent = true;
        console.log(`[GSX] ★ HALBZEIT: ${currentPax}/${total} Pax (${pct}%)`);
        this.onGsxEvent('BOARDING_HALFWAY', { pct });
      }

      // BOARDING COMPLETE: Ziel erreicht
      const total2 = this._gsxTotalPax;
      if (total2 > 0 && currentPax >= total2 && !this._boardingCompleteSent) {
        this._boardingCompleteSent = true;
        console.log(`[GSX] ★ BOARDING COMPLETE: ${currentPax}/${total2} Pax`);
        this._broadcast({ type: 'GSX_BOARDING_STATE', payload: { state: 4, name: 'COMPLETED' } });
        if (this.onGsxEvent) this.onGsxEvent('BOARDING_COMPLETE', {});
      }
    }

    this._prevPaxBoarding = currentPax;

    // ── BOARDING_STATE trotzdem tracken ──────────────────────
    if (boarding !== this._gsxBoarding) {
      const prev = this._gsxBoarding;
      this._gsxBoarding = boarding;
      const name = GSX_STATE[boarding] || '?';
      console.log(`[GSX LVAR] Boarding State: ${GSX_STATE[prev]||prev} → ${name} (${boarding})`);
      this._broadcast({ type: 'GSX_BOARDING_STATE', payload: { state: boarding, name } });

      // Reset für neuen Zyklus
      if (boarding === 1 && prev !== -1) {
        console.log('[GSX] Reset für nächsten Boarding-Zyklus');
        this._boardingStartSent    = false;
        this._boardingCompleteSent = false;
        this._prevPaxBoarding      = 0;
        this._halfwaySent          = false;
      }
    }

    // ── Deboarding ────────────────────────────────────────────
    if (deboarding !== this._gsxDeboarding) {
      this._gsxDeboarding = deboarding;
      this._broadcast({ type: 'GSX_DEBOARDING_STATE', payload: { state: deboarding } });
    }
  }

  // ── Mock-Modus ────────────────────────────────────────────
  _startMock() {
    this._mockMode   = true;
    this.isConnected = true;
    console.log('[SimConnect] Mock-Modus aktiv');
    this._broadcast({ type: 'SIM_CONNECTED', payload: { name: 'MSFS 2024 (Simulation)' } });

    let step = 0;
    this._mockTimer = setInterval(() => {
      this.simData = { ...MOCK_SEQUENCE[step % MOCK_SEQUENCE.length] };
      this._broadcast({ type: 'SIM_DATA', payload: this.simData });
      if (this.onData) this.onData(this.simData);
      step++;
    }, 5000);

    // Mock: Boarding nach 15s simulieren
    setTimeout(() => { if (this.onGsxEvent) this.onGsxEvent('BOARDING_START',    { paxTarget: 169 }); }, 15000);
    setTimeout(() => { if (this.onGsxEvent) this.onGsxEvent('BOARDING_HALFWAY',  { pct: 50 }); },       45000);
    setTimeout(() => { if (this.onGsxEvent) this.onGsxEvent('BOARDING_COMPLETE', {}); },                90000);
  }

  resetGsx() {
    this._gsxBoarding          = -1;
    this._gsxDeboarding        = -1;
    this._prevPaxBoarding      = 0;
    this._gsxTotalPax          = 0;
    this._halfwaySent          = false;
    this._boardingStartSent    = false;
    this._boardingCompleteSent = false;
  }

  disconnect() {
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    if (this._mockTimer)      clearInterval(this._mockTimer);
    try { if (this._handle) this._handle.close(); } catch (e) {}
    this.isConnected = false;
  }

  _broadcast(data) {
    const json = JSON.stringify(data);
    this.wss?.clients?.forEach(c => {
      if (c.readyState === WebSocket.OPEN) c.send(json);
    });
  }
}

module.exports = SimConnectService;
