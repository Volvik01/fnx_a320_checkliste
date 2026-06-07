/**
 * Fenix ACP Debug v2 — liest ALLE vorhandenen LVARs
 * und filtert nach ACP/ASP/VOL/CAB relevanten Werten
 */

async function main() {
  const sc = require('node-simconnect');
  const { open, Protocol, SimConnectDataType, SimConnectPeriod, SimConnectConstants } = sc;

  console.log('\n=== Fenix ACP Debug v2 ===');
  console.log('Verbinde mit MSFS...\n');

  const { recvOpen, handle } = await open('ACP-Debug-v2', Protocol.KittyHawk);
  console.log('✓ Verbunden:', recvOpen.applicationName);
  console.log('Suche alle Fenix LVARs...\n');

  // Alle möglichen Fenix LVAR-Präfixe
  const PREFIXES = [
    'S_ASP', 'A_ASP', 'B_ASP',
    'S_ACP', 'A_ACP', 'B_ACP',
    'FNX_ASP', 'FNX_ACP',
    'FNXA32X',
  ];

  // Viele mögliche Suffixe
  const CHANNELS = ['CAB','PA','INT','VHF1','VHF2','VHF3','HF1','HF2'];
  const TYPES    = ['VOL','RECV','SEND','SEL','MUT','REC','TX'];
  const SIDES    = ['CPT','FO',''];

  // Alle Kombinationen generieren
  const lvars = [];
  for (const pre of PREFIXES) {
    for (const side of SIDES) {
      for (const ch of CHANNELS) {
        for (const typ of TYPES) {
          const name = side
            ? `${pre}_${side}_${typ}_${ch}`
            : `${pre}_${typ}_${ch}`;
          lvars.push(name);
        }
      }
    }
  }

  // Noch einige bekannte Einzelnamen
  const extra = [
    'AIRCRAFT_VOLUME_CAB', 'AIRCRAFT_VOLUME_INT',
    'CAB_VOL', 'PA_VOL', 'INT_VOL',
    'CABIN_VOLUME', 'PA_VOLUME',
    'L_ACP_CAB_VOLUME', 'L_ACP_PA_VOLUME',
    'FENIX_CAB_VOL', 'FENIX_PA_VOL',
  ];
  lvars.push(...extra);

  console.log(`Teste ${lvars.length} LVAR-Kombinationen...\n`);

  const BASE = 600;
  const values = {};
  const found  = [];

  // In Batches registrieren (SimConnect hat Limits)
  const BATCH = 200;
  for (let i = 0; i < Math.min(lvars.length, BATCH); i++) {
    values[lvars[i]] = -999;
    try {
      handle.addToDataDefinition(BASE + i, `L:${lvars[i]}`, 'number', SimConnectDataType.FLOAT64);
      handle.requestDataOnSimObject(BASE + i, BASE + i, SimConnectConstants.OBJECT_ID_USER, SimConnectPeriod.SECOND);
    } catch(e) {}
  }

  handle.on('simObjectData', (recv) => {
    const idx = recv.requestID - BASE;
    if (idx < 0 || idx >= lvars.length) return;
    const name = lvars[idx];
    try {
      const val = parseFloat(recv.data.readFloat64().toFixed(3));
      if (val !== values[name]) {
        const old = values[name];
        values[name] = val;

        if (old === -999 && val !== 0) {
          found.push({ name, val });
          console.log(`[GEFUNDEN] ${name} = ${val}`);
        } else if (old !== -999) {
          console.log(`\n★ ÄNDERUNG: ${name}: ${old} → ${val}`);
        }
      }
    } catch(e) {}
  });

  handle.on('exception', () => {});

  setTimeout(() => {
    console.log(`\nDrehe jetzt am CAB-Knopf...`);
    console.log('(Strg+C zum Beenden)\n');
  }, 4000);
}

main().catch(e => console.error('Fehler:', e.message));
