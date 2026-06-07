/**
 * TTS Test Tool
 * Testet ob Piper funktioniert
 * node test-tts.js
 */

const { spawn } = require('child_process');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const PROJECT_ROOT = __dirname;
const PIPER_EXE    = path.join(PROJECT_ROOT, 'piper', 'piper.exe');
const VOICES_DIR   = path.join(PROJECT_ROOT, 'piper', 'voices');

console.log('\n=== TTS Test Tool ===\n');
console.log('Piper-Pfad:  ', PIPER_EXE);
console.log('Piper exists:', fs.existsSync(PIPER_EXE));
console.log('Voices-Pfad: ', VOICES_DIR);

if (fs.existsSync(VOICES_DIR)) {
  const voices = fs.readdirSync(VOICES_DIR).filter(f => f.endsWith('.onnx'));
  console.log('Stimmen:     ', voices);
} else {
  console.log('Voices-Ordner NICHT gefunden!');
}

if (!fs.existsSync(PIPER_EXE)) {
  console.log('\n✗ piper.exe nicht gefunden!');
  console.log('  Stelle sicher dass piper/piper.exe existiert.');
  process.exit(1);
}

const voices = fs.readdirSync(VOICES_DIR).filter(f => f.endsWith('.onnx'));
if (!voices.length) {
  console.log('\n✗ Keine Stimmdateien (.onnx) in piper/voices/ gefunden!');
  process.exit(1);
}

const voicePath = path.join(VOICES_DIR, voices[0]);
const tmpWav    = path.join(os.tmpdir(), 'tts_test.wav');
const text      = 'Willkommen an Bord von Condor. Dies ist ein Testlauf der Sprachausgabe.';

console.log('\nVerwende Stimme:', voices[0]);
console.log('Text:', text);
console.log('\nGeneriere Audio...');

const piper = spawn(PIPER_EXE, [
  '--model',       voicePath,
  '--output_file', tmpWav,
]);

piper.stdin.write(text);
piper.stdin.end();

piper.stderr.on('data', d => process.stdout.write(d));

piper.on('close', (code) => {
  console.log('Piper exit code:', code);

  if (code !== 0) {
    console.log('✗ Piper fehlgeschlagen!');
    process.exit(1);
  }

  const size = fs.existsSync(tmpWav) ? fs.statSync(tmpWav).size : 0;
  console.log('WAV erstellt:', tmpWav, '(' + Math.round(size/1024) + ' KB)');

  if (size === 0) {
    console.log('✗ WAV-Datei ist leer!');
    process.exit(1);
  }

  console.log('\nSpiele Audio ab...');

  const player = spawn('powershell', [
    '-Command',
    `(New-Object Media.SoundPlayer '${tmpWav}').PlaySync(); Remove-Item '${tmpWav}' -Force`
  ]);

  player.stderr.on('data', d => process.stdout.write(d));
  player.on('close', (c) => {
    console.log(c === 0 ? '\n✓ Audio erfolgreich abgespielt!' : '\n✗ Wiedergabe fehlgeschlagen (Code: ' + c + ')');
  });
  player.on('error', (e) => {
    console.log('✗ PowerShell Fehler:', e.message);
  });
});

piper.on('error', (e) => {
  console.log('\n✗ Piper Fehler:', e.message);
});
