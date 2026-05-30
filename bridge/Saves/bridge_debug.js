const WebSocket = require('ws');
const { open, SimConnectPeriod, SimConnectDataType } = require('node-simconnect');

const PORT = 8765;
const wss = new WebSocket.Server({ port: PORT });
console.log(`[BRIDGE] WebSocket läuft auf ws://localhost:${PORT}`);
console.log('[BRIDGE] Warte auf MSFS Verbindung...');

// ─── L-VARs via SimConnect ───
const LVARS = [
  'S_OH_ELEC_BAT1',
  'S_OH_ELEC_BAT2',
  'S_OH_SIGNS_SMOKING',
  'I_OH_ELEC_EXT_PWR_U',
  'S_OH_ELEC_APU_MASTER',
  'I_OH_ELEC_APU_MASTER_L',
  'S_ENG_MASTER_1',
  'S_ENG_MASTER_2',
  'S_ENG_MODE',
  'S_OH_EXT_LT_BEACON',
  'S_OH_EXT_LT_STROBE',
  'S_OH_EXT_LT_LANDING_L',
  'S_OH_EXT_LT_LANDING_R',
  'S_OH_EXT_LT_NOSE',
  'S_OH_EXT_LT_RWY_TURNOFF',
  'S_OH_EXT_LT_WING',
  'S_OH_EXT_LT_NAV_LOGO',
  'S_OH_FUEL_LEFT_1',
  'S_OH_FUEL_LEFT_2',
  'S_OH_FUEL_RIGHT_1',
  'S_OH_FUEL_RIGHT_2',
  'S_OH_FUEL_CENTER_1',
  'S_OH_FUEL_CENTER_2',
  'S_OH_FUEL_XFEED',
  'S_OH_FUEL_MODE_SEL',
  'S_OH_NAV_IR1_MODE',
  'S_OH_NAV_IR2_MODE',
  'S_OH_NAV_IR3_MODE',
  'S_OH_PNEUMATIC_APU_BLEED',
  'S_OH_PNEUMATIC_PACK_1',
  'S_OH_PNEUMATIC_PACK_2',
  'S_OH_PNEUMATIC_ENG1_ANTI_ICE',
  'S_OH_PNEUMATIC_ENG2_ANTI_ICE',
  'S_OH_PNEUMATIC_WING_ANTI_ICE',
  'S_OH_PROBE_HEAT',
  'S_OH_SIGNS',
  'S_OH_INT_LT_EMER',
  'S_OH_OXYGEN_CREW_OXYGEN',
  'S_MIP_PARKING_BRAKE',
  'S_FC_FLAPS',
  'A_FC_SPEEDBRAKE',
  'S_FCU_EFIS1_BARO_STD',
  'S_XPDR_OPERATION',
  'S_XPDR_ALTREPORTING',
  'I_FCU_EFIS1_FD',
  'B_FCU_SPEED_DASHED',
];

const DEF_OFFSET = 100;
const REQ_OFFSET = 200;

// ─── AAO WebAPI L-VARs (für Variablen die SimConnect nicht lesen kann) ───
// AAO_LVARS: Hier zukünftige L-VARs eintragen die nicht via SimConnect lesbar sind
const AAO_LVARS = [];
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
];

let simValues = {};
LVARS.forEach(n => simValues[n] = 0);
SIMVARS.forEach(sv => simValues[sv.key] = 0);
AAO_LVARS.forEach(n => simValues[n] = 0);

const clients = new Set();
function broadcast() {
  const msg = JSON.stringify({ type: 'lvar_update', values: simValues });
  clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
}

wss.on('connection', ws => {
  clients.add(ws);
  console.log(`[BRIDGE] App verbunden`);
  ws.send(JSON.stringify({ type: 'lvar_update', values: simValues }));
  ws.on('close', () => { clients.delete(ws); });
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
      console.log(`[DEBUG] Packet reqID=${packet.requestID} data=${JSON.stringify(packet.data)?.slice(0,60)}`);
      // A-Var
      if (packet.requestID >= 400) {
        const idx = packet.requestID - 400;
        if (idx < SIMVARS.length) {
          const raw = packet.data;
          let val = 0;
          if (typeof raw === 'number') val = raw;
          else if (raw && 'buffer' in raw) {
            const buf = Buffer.from(raw.buffer.data ?? raw.buffer);
            val = buf.readDoubleLE(raw.offset ?? 0);
          }
          simValues[SIMVARS[idx].key] = Math.round(val * 100) / 100;
          broadcast();
        }
        return;
      }

      // L-VAR
      const idx = packet.requestID - REQ_OFFSET;
      if (idx >= 0 && idx < LVARS.length) {
        const raw = packet.data;
        let val = 0;
        if (typeof raw === 'number') val = raw;
        else if (raw && typeof raw === 'object') {
          if ('value' in raw && typeof raw.value === 'number') val = raw.value;
          else if ('buffer' in raw) {
            const buf = Buffer.from(raw.buffer.data ?? raw.buffer);
            val = buf.readDoubleLE(raw.offset ?? 0);
          } else val = Object.values(raw)[0] ?? 0;
        }
        const rounded = Math.round(val);
        simValues[LVARS[idx]] = rounded;
        broadcast();
      }
    });

    handle.on('exception', e => {
      console.log(`[EXCEPTION] ${e.exceptionName} sendId=${e.sendId} idx=${e.sendId-200}`);
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
    pollAll();

    // AAO WebAPI für EXT PWR
    startAAOPolling();

  } catch(e) {
    console.log('[BRIDGE] Fehler:', e.message, '– retry in 5s');
    setTimeout(connectToSim, 5000);
  }
}

connectToSim();
