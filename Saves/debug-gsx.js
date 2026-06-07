/**
 * GSX Debug Tool v2 — zeigt ALLE GSX LVARs die sich ändern
 * Starte BEVOR GSX den automatischen Ablauf startet
 * node debug-gsx.js
 */

async function main() {
  const sc = require('node-simconnect');
  const { open, Protocol, SimConnectDataType, SimConnectPeriod, SimConnectConstants } = sc;

  console.log('\n=== GSX Pro Debug Tool v2 ===');
  console.log('Verbinde mit MSFS...\n');

  const { recvOpen, handle } = await open('GSX-Debug-v2', Protocol.KittyHawk);
  console.log('✓ Verbunden:', recvOpen.applicationName, '\n');

  // Alle bekannten GSX LVARs die wir überwachen wollen
  const GSX_LVARS = [
    'FSDT_GSX_BOARDING_STATE',
    'FSDT_GSX_DEBOARDING_STATE',
    'FSDT_GSX_BOARDING_PAX_PCT',
    'FSDT_GSX_NUMPASSENGERS',
    'FSDT_GSX_NUMPASSENGERS_BOARDING_TOTAL',
    'FSDT_GSX_NUMPASSENGERS_BOARDING',
    'FSDT_GSX_CATERING_STATE',
    'FSDT_GSX_FUELING_STATE',
    'FSDT_GSX_JETWAY_STATE',
    'FSDT_GSX_STATE',
    'FSDT_GSX_MENU_OPEN',
    'FSDT_GSX_COUATL_STARTED',
    'FSDT_GSX_ENGINE_TYPE',
    'FSDT_GSX_AIRCRAFT_ID',
    'FSDT_GSX_PILOTS_IN_COCKPIT',
    'FSDT_GSX_NUMCREW',
    'FSDT_GSX_BOARDING_CARGO_PCT',
    'FSDT_GSX_DEBOARDING_CARGO_PCT',
    'FSDT_GSX_PAYLOAD_SYSTEM_ID',
  ];

  const GSX_STATE_NAMES = {
    0:'UNAVAILABLE', 1:'AVAILABLE', 2:'REQUESTED',
    3:'PERFORMING',  4:'COMPLETED', 5:'BYPASSED', 6:'DISABLED'
  };

  // Jeden LVAR einzeln registrieren
  const values = {};
  const BASE = 300;

  GSX_LVARS.forEach((lvar, i) => {
    const id = BASE + i;
    values[lvar] = -999;
    try {
      handle.addToDataDefinition(id, `L:${lvar}`, 'number', SimConnectDataType.FLOAT64);
      handle.requestDataOnSimObject(id, id, SimConnectConstants.OBJECT_ID_USER, SimConnectPeriod.SECOND);
    } catch(e) {}
  });

  handle.on('simObjectData', (recv) => {
    const idx = recv.requestID - BASE;
    if (idx < 0 || idx >= GSX_LVARS.length) return;
    const name = GSX_LVARS[idx];
    try {
      const val = Math.round(recv.data.readFloat64());
      if (val !== values[name]) {
        const old = values[name];
        values[name] = val;

        // Zustandsnamen für bekannte States
        const isState = name.includes('STATE');
        const oldName = isState ? (GSX_STATE_NAMES[old]||old) : old;
        const newName = isState ? (GSX_STATE_NAMES[val]||val) : val;

        const ts = new Date().toLocaleTimeString('de');
        if (old === -999) {
          console.log(`[${ts}] ${name} = ${newName} (${val})`);
        } else {
          console.log(`[${ts}] ★ ÄNDERUNG: ${name}`);
          console.log(`          ${oldName} → ${newName} (${old}→${val})`);
        }
      }
    } catch(e) {}
  });

  handle.on('exception', () => {});
  handle.on('error', (e) => console.error('Fehler:', e));

  console.log(`Überwache ${GSX_LVARS.length} GSX LVARs...`);
  console.log('Starte jetzt den GSX-Ablauf (Fuel → Catering → Boarding)\n');
  console.log('━'.repeat(60));
}

main().catch(e => {
  console.error('Fehler:', e.message);
  console.error('Stelle sicher dass MSFS läuft und node-simconnect installiert ist.');
});

// Fenix ACP LVARs zum Debug-Tool hinzufügen
const FENIX_ACP_LVARS = [
  'S_OH_INTLT_ANN_LT',
  'A_ASP_CPT_REC_CAB',
  'A_ASP_CPT_VOL_CAB',
  'A_ASP_CPT_VOL_PA',
  'A_ASP_CPT_VOL_VHF1',
  'A_ASP_CPT_VOL_VHF2',
  'A_ASP_CPT_VOL_INT',
  'A_ASP_FO_VOL_CAB',
  'A_ASP_FO_VOL_PA',
  'S_ASP_CPT_CAB_RECV',
  'S_ASP_CPT_PA_RECV',
  'FNX_ACP_CAB_VOL',
  'FNX_ACP_PA_VOL',
  'FNX_ACP_INT_VOL',
  'FNX_ASP_CPT_CAB_VOL',
  'FNX_ASP_CPT_PA_VOL',
];
