const WebSocket = require('ws');
const { open, SimConnectPeriod, SimConnectDataType } = require('node-simconnect');

const PORT = 8765;
const wss = new WebSocket.Server({ port: PORT });
console.log(`[BRIDGE] WebSocket läuft auf ws://localhost:${PORT}`);
console.log('[BRIDGE] Warte auf MSFS Verbindung...');

// ─── L-VARs via SimConnect ───
const LVARS = [
  //'S_OH_ELEC_BAT1',
  'S_OH_ELEC_BAT2',
  'S_OH_SIGNS_SMOKING',
  'I_OH_ELEC_EXT_PWR_U',
  //'S_OH_ELEC_APU_MASTER',
  'I_OH_ELEC_APU_MASTER_L',
  'S_OH_ELEC_APU_START',
  'I_OH_ELEC_APU_START_U',
  'S_ENG_MODE',
  'S_OH_EXT_LT_BEACON',
  'S_OH_EXT_LT_STROBE',
  'S_OH_EXT_LT_LANDING_L',
  'S_OH_EXT_LT_LANDING_R',
  'S_OH_EXT_LT_NOSE',
  //S_OH_EXT_LT_RWY_TURNOFF',
  //'S_OH_EXT_LT_WING',
  'S_OH_EXT_LT_NAV_LOGO',
  //'S_OH_FUEL_LEFT_1',
  //'S_OH_FUEL_LEFT_2',
  //'S_OH_FUEL_RIGHT_1',
  'S_OH_FUEL_RIGHT_2',
  //'S_OH_FUEL_CENTER_1',
  //'S_OH_FUEL_CENTER_2',
  //'S_OH_FUEL_XFEED',
  //'S_OH_FUEL_MODE_SEL',
  //'S_OH_NAV_IR1_MODE',
  //'S_OH_NAV_IR2_MODE',
  'S_OH_NAV_IR3_MODE',
  //'S_OH_PNEUMATIC_APU_BLEED',
  //'S_OH_PNEUMATIC_PACK_1',
  //'S_OH_PNEUMATIC_PACK_2',
  //'S_OH_PNEUMATIC_ENG1_ANTI_ICE',
  //'S_OH_PNEUMATIC_ENG2_ANTI_ICE',
  //'S_OH_PNEUMATIC_WING_ANTI_ICE',
  //'S_OH_PROBE_HEAT',
  'S_OH_SIGNS',
  'S_OH_INT_LT_EMER',
  'S_OH_OXYGEN_CREW_OXYGEN',
  'S_MIP_PARKING_BRAKE',
  'S_FC_FLAPS',
  //'A_FC_SPEEDBRAKE',
  //'S_FCU_EFIS1_BARO_STD',
  'S_XPDR_OPERATION',
  'S_XPDR_ALTREPORTING',
  'I_FCU_EFIS1_FD',
  'B_FCU_SPEED_DASHED',
  'B_FCU_HEADING_DASHED',
  'S_XPDR_MODE',
  //'I_OH_ENG_MANSTART_1_L',
  //'I_OH_ENG_MANSTART_2_L',
  'S_MIP_GEAR',
  'S_WR_PRED_WS',
  'S_WR_SYS',
  'I_MIP_AUTOBRAKE_MAX_L',
  'I_MIP_AUTOBRAKE_MED_L',
  'I_OH_RCRD_GND_CTL_L',
  'A_FC_THROTTLE_LEFT_INPUT',
  'A_FC_THROTTLE_RIGHT_INPUT',
  'S_ENG_MASTER_2',
  'S_ENG_MASTER_1',
  'A_FC_ELEVATOR_TRIM',
  'I_ECAM_TO',
  'S_FC_RUDDER_TRIM_RESET',
  //'S_MIP_GPWS_TERRAIN_ON_ND_CAPT',
  //'I_MIP_GPWS_TERRAIN_ON_ND_CAPT_L',
  
];

const DEF_OFFSET = 100;
const REQ_OFFSET = 200;

// ─── AAO WebAPI L-VARs (für Variablen die SimConnect nicht lesen kann) ───
// AAO_LVARS: Hier zukünftige L-VARs eintragen die nicht via SimConnect lesbar sind
const AAO_LVARS = [
  //'S_ENG_MASTER_1',
  //'S_ENG_MASTER_2',
];
const AAO_PORT = 43380;

// Standard SimVars
const SIMVARS = [
  { name: 'ELECTRICAL MASTER BATTERY:1',  unit: 'bool',    key: 'A_BAT1' },
  { name: 'ELECTRICAL MASTER BATTERY:2',  unit: 'bool',    key: 'A_BAT2' },
  { name: 'BRAKE PARKING INDICATOR',      unit: 'bool',    key: 'A_PARK_BRAKE' },
  { name: 'LIGHT BEACON',                 unit: 'bool',    key: 'A_LT_BEACON' },
  { name: 'LIGHT STROBE',                 unit: 'bool',    key: 'A_LT_STROBE' },
  { name: 'LIGHT LANDING',                unit: 'bool',    key: 'A_LT_LANDING' },
  { name: 'LIGHT TAXI',                   unit: 'bool',    key: 'A_LT_TAXI' },
  { name: 'LIGHT NAV',                    unit: 'bool',    key: 'A_LT_NAV' },
  { name: 'FLAPS HANDLE INDEX',           unit: 'number',  key: 'A_FLAPS' },
  { name: 'SPOILERS ARMED',               unit: 'bool',    key: 'A_SPOILERS_ARM' },
  { name: 'TRANSPONDER STATE:1',          unit: 'number',  key: 'A_XPDR' },
  { name: 'APU SWITCH',                   unit: 'bool',    key: 'A_APU_SW' },
  { name: 'CABIN SEATBELTS ALERT SWITCH', unit: 'bool',    key: 'A_SEATBELTS' },
  { name: 'INDICATED ALTITUDE',           unit: 'feet',    key: 'A_ALT' },
  { name: 'VERTICAL SPEED',               unit: 'ft/min',  key: 'A_VS' },
  { name: 'RADIO HEIGHT',                 unit: 'feet',    key: 'A_RADIO_ALT' },
  { name: 'AIRSPEED INDICATED',            unit: 'knots',   key: 'A_AIRSPEED' },
  { name: 'LOCAL TIME',                     unit: 'seconds', key: 'A_LOCAL_TIME' },
  { name: 'ENG N2 RPM:1',                  unit: 'percent', key: 'A_ENG1_N2' },
  { name: 'ENG N2 RPM:2',                  unit: 'percent', key: 'A_ENG2_N2' },
  { name: 'SPOILERS_LEVER_ARM-DISARM',    unit: 'bool',    key: 'A_FC_SPEEDBRAKE' },
];

let simValues = {};
let simHandle  = null;  // globaler SimConnect Handle
let chrEnabled = false; // CHR Auto-Trigger (per Settings steuerbar)
let chrState   = 'idle'; // idle | running | stopped
LVARS.forEach(n => simValues[n] = 0);
SIMVARS.forEach(sv => simValues[sv.key] = 0);
AAO_LVARS.forEach(n => simValues[n] = 0);

const clients = new Set();
function broadcast() {
  const msg = JSON.stringify({ type: 'lvar_update', values: simValues });
  clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
}

// Lokale IP ermitteln
function getLocalIP() {
  const os = require('os');
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

wss.on('connection', ws => {
  clients.add(ws);
  console.log(`[BRIDGE] App verbunden`);
  ws.send(JSON.stringify({ type: 'lvar_update', values: simValues }));
  // IP + Tablet-URL senden
  ws.send(JSON.stringify({ type: 'server_info', ip: getLocalIP(), port: 8766 }));
  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'set_chr') {
        chrEnabled = !!data.enabled;
        console.log('[CHR] Auto-Trigger ' + (chrEnabled ? 'aktiviert' : 'deaktiviert'));
      }
    } catch(e) {}
  });
  ws.on('close', () => { clients.delete(ws); });
});


// ─── HTTP Server für Tablet-Zugriff ───
const http_module = require('http');
const fs_module   = require('fs');
const path_module = require('path');

const HTTP_PORT = 8766;
const httpServer = http_module.createServer((req, res) => {
  const indexPath = path_module.join(__dirname, '..', 'src', 'index.html');
  fs_module.readFile(indexPath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('index.html nicht gefunden');
      return;
    }
    const html = data.toString().replace(
      "ws://localhost:8765",
      `ws://${req.headers.host?.split(':')[0] || 'localhost'}:8765`
    );
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
});
httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`[HTTP] Tablet-Zugriff: http://${getLocalIP()}:${HTTP_PORT}`);
});

// ─── AAO WebAPI L-VAR Polling ───
function startAAOPolling() {
  const http = require('http');

  // L-VARs via AAO RPN Calculator Code lesen
  function readAAOLvars(names) {
    return new Promise((resolve) => {
      if (names.length === 0) { resolve({}); return; }

      // Jede L-VAR als RPN Script abfragen
      // Format: {"scripts":[{"code":"(L:VARNAME,number)","id":"VARNAME"},...]}
      const scripts = names.map(n => ({
        code: `(L:${n},number)`,
        id: n
      }));
      const query = encodeURIComponent(JSON.stringify({ scripts }));
      const url = `http://localhost:${AAO_PORT}/webapi?json=${query}`;

      http.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const result = {};
            // AAO antwortet mit { scripts: [{id:"VARNAME", value:0.0},...] }
            if (parsed.scripts && Array.isArray(parsed.scripts)) {
              parsed.scripts.forEach((item, idx) => {
                const name = item.id ?? names[idx];
                result[name] = Math.round(Number(item.value ?? item.result ?? 0));
              });
            } else {
              // Fallback: getvars
              const getvars = names.map(n => ({ name: `L:${n}`, unit: 'number' }));
              const q2 = encodeURIComponent(JSON.stringify({ getvars }));
              http.get(`http://localhost:${AAO_PORT}/webapi?json=${q2}`, (r2) => {
                let d2 = '';
                r2.on('data', c => d2 += c);
                r2.on('end', () => {
                  try {
                    const p2 = JSON.parse(d2);
                    if (p2.getvars) {
                      p2.getvars.forEach((item, idx) => {
                        result[names[idx]] = Math.round(Number(item.value ?? 0));
                      });
                    }
                    resolve(result);
                  } catch(e) { resolve(result); }
                });
              }).on('error', () => resolve(result));
              return;
            }
            resolve(result);
          } catch(e) { resolve(null); }
        });
      }).on('error', (e) => {
        console.log('[AAO] HTTP Fehler:', e.message);
        resolve(null);
      });
    });
  }

  let aaoAvailable = false;

  async function pollAAO() {
    const result = await readAAOLvars(AAO_LVARS);
    if (result === null) {
      if (aaoAvailable) {
        aaoAvailable = false;
        console.log('[AAO] Nicht erreichbar');
      }
      return;
    }
    if (!aaoAvailable) {
      aaoAvailable = true;
      console.log('[AAO] Verbunden! Lese EXT PWR L-VARs...');
    }
    let changed = false;
    for (const [name, val] of Object.entries(result)) {
      if (AAO_LVARS.includes(name) && simValues[name] !== val) {
        simValues[name] = val;
        console.log(`[AAO] ${name} = ${val}`);
        changed = true;
      }
    }
    if (changed) broadcast();
  }

  setInterval(pollAAO, 500);
  pollAAO();
}

// ─── Float64 Parser für SimConnect Buffer ───
// node-simconnect gibt { buffer: Buffer, offset: number } zurück
// Der Buffer enthält: [reqID(4), defID(4), value(8)] → Wert bei offset 8
function readFloat64(raw) {
  try {
    if (typeof raw === 'number') return raw;
    if (raw === null || raw === undefined) return 0;
    if ('value' in raw && typeof raw.value === 'number') return raw.value;

    let buf, offset;
    if (Buffer.isBuffer(raw)) {
      buf = raw; offset = 0;
    } else if (raw && 'buffer' in raw) {
      const b = raw.buffer;
      buf = Buffer.isBuffer(b) ? b : Buffer.from(b.data ?? b);
      offset = typeof raw.offset === 'number' ? raw.offset : 8;
    } else {
      const v = Object.values(raw).find(x => typeof x === 'number');
      return v ?? 0;
    }

    if (!buf || buf.length < offset + 8) {
      // Fallback: offset 0
      if (buf && buf.length >= 8) return buf.readDoubleLE(0);
      return 0;
    }
    return buf.readDoubleLE(offset);
  } catch(e) { return 0; }
}

// ─── CHR Auto-Trigger (Start bei 10ft RA, Stopp bei Touchdown) ───
function checkChrTrigger() {
  if (!chrEnabled) return;
  const radioAlt = simValues['A_RADIO_ALT'] ?? 9999;
  const vs       = simValues['A_VS']        ?? 0;
  const onGround = radioAlt < 1;

  // START: Sinkflug, 10ft unterschritten, noch nicht gestartet
  if (chrState === 'idle' && vs < -50 && radioAlt <= 10 && radioAlt > 0) {
    chrState = 'running';
    console.log('[CHR] START – Radio Alt ' + radioAlt.toFixed(1) + 'ft');
    writeLVar('S_MIP_CLOCK_CHR', 1);
    broadcastChrEvent('start');
  }

  // STOPP: Aufgesetzt (RA < 1ft) und CHR läuft
  if (chrState === 'running' && onGround) {
    chrState = 'stopped';
    console.log('[CHR] STOPP – Touchdown');
    writeLVar('S_MIP_CLOCK_CHR', 1); // zweiter Druck = Stopp
    broadcastChrEvent('stop');
  }

  // RESET für nächste Landung: wieder in der Luft über 100ft
  if (chrState === 'stopped' && radioAlt > 100) {
    chrState = 'idle';
    console.log('[CHR] bereit für nächste Landung');
  }
}

function writeLVar(name, value) {
  // Methode 1: direkt via SimConnect (MobiFlight WASM muss installiert sein)
  if (simHandle) {
    try {
      const DEF_WRITE = 900;
      simHandle.addToDataDefinition(DEF_WRITE, 'L:' + name, 'number', SimConnectDataType.FLOAT64);
      const buf = Buffer.allocUnsafe(8);
      buf.writeDoubleLE(value, 0);
      simHandle.setDataOnSimObject(DEF_WRITE, 0, 0, 0, 8, buf);
      console.log('[CHR] L:' + name + ' = ' + value + ' (SimConnect)');
      return;
    } catch(e) {
      console.log('[CHR] SimConnect Write Fehler:', e.message);
    }
  }
  // Methode 2: Fallback via AAO WebAPI
  const http = require('http');
  const payload = JSON.stringify({ scripts: [{ code: value + ' (>L:' + name + ')', id: 'chr' }] });
  const query = encodeURIComponent(payload);
  http.get('http://localhost:' + AAO_PORT + '/webapi?json=' + query, (res) => {
    let d = ''; res.on('data', c => d += c);
    res.on('end', () => console.log('[CHR] L:' + name + ' = ' + value + ' (AAO Fallback)'));
  }).on('error', e => console.log('[CHR] Kein Write möglich:', e.message));
}

function broadcastChrEvent(event) {
  const msg = JSON.stringify({ type: 'chr_event', event });
  clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
}

// ─── SimConnect Verbindung ───
async function connectToSim() {
  try {
    let result;
    for (const proto of [4, 3, 2]) {
      try {
        result = await open('FenixChecklist', proto);
        console.log(`[BRIDGE] Protokoll ${proto} OK`);
        break;
      } catch(e) {}
    }
    if (!result) throw new Error('Kein Protokoll funktioniert');
    const { recvOpen, handle } = result;
    simHandle = handle;
    console.log(`[BRIDGE] SimConnect verbunden: ${recvOpen.applicationName}`);

    // L-VARs registrieren
    LVARS.forEach((name, idx) => {
      handle.addToDataDefinition(DEF_OFFSET + idx, `L:${name}`, 'number', SimConnectDataType.FLOAT64);
    });

    // A-Vars registrieren
    const SV_DEF = 300;
    const SV_REQ = 400;
    SIMVARS.forEach(({ name, unit }, idx) => {
      handle.addToDataDefinition(SV_DEF + idx, name, unit, SimConnectDataType.FLOAT64);
    });

    function pollAll() {
      LVARS.forEach((_, idx) => {
        handle.requestDataOnSimObject(REQ_OFFSET + idx, DEF_OFFSET + idx, 0, SimConnectPeriod.ONCE);
      });
      SIMVARS.forEach((_, idx) => {
        handle.requestDataOnSimObject(SV_REQ + idx, SV_DEF + idx, 0, SimConnectPeriod.ONCE);
      });
    }

    handle.on('simObjectData', packet => {
      // A-Var
      if (packet.requestID >= 400) {
        const idx = packet.requestID - 400;
        if (idx < SIMVARS.length) {
          const val = readFloat64(packet.data);
          simValues[SIMVARS[idx].key] = Math.round(val * 100) / 100;
          broadcast();
        }
        return;
      }

      // L-VAR
      const idx = packet.requestID - REQ_OFFSET;
      if (idx >= 0 && idx < LVARS.length) {
        const val = readFloat64(packet.data);
        const rounded = Math.round(val);
        simValues[LVARS[idx]] = rounded;
        broadcast();
      }
    });

    handle.on('exception', e => {
      if (e.exceptionName === 'UNRECOGNIZED_ID') {
        const idx = (e.sendId - 200);
        if (idx >= 0 && idx < LVARS.length) {
          console.log(`[SKIP] L-VAR nicht gefunden: ${LVARS[idx]}`);
        }
      }
    });

    handle.on('close', () => {
      console.log('[BRIDGE] Sim getrennt, retry in 5s...');
      setTimeout(connectToSim, 5000);
    });

    setInterval(pollAll, 500);
    setInterval(checkChrTrigger, 200); // CHR alle 200ms prüfen
    pollAll();

    // AAO WebAPI für EXT PWR
    startAAOPolling();

  } catch(e) {
    console.log('[BRIDGE] Fehler:', e.message, '– retry in 5s');
    setTimeout(connectToSim, 5000);
  }
}

connectToSim();
