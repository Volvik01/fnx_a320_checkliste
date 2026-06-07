# Condor Cabin Manager — Installationsanleitung

## Systemvoraussetzungen

- **Windows 10/11** (64-bit)
- **Node.js v18+** — https://nodejs.org (LTS empfohlen)
- **Microsoft Flight Simulator 2024**
- **Fenix A320**
- **GSX Pro** (FSDT)
- **SimBrief-Account** — https://simbrief.com

---

## Schritt 1 — ZIP entpacken

ZIP entpacken nach einem Ordner, z.B.:
```
C:\FlightSim\condor-cabin-manager\
```

Struktur:
```
condor-cabin-manager\
  flightcabin\
    src\
    electron\
    start.bat
    start-electron.bat  (oder electron\start-electron.bat)
    package.json
```

---

## Schritt 2 — Pakete installieren

Eingabeaufforderung im `flightcabin`-Ordner öffnen:

```cmd
npm install
npm install node-simconnect
```

Das war es — keine weitere Software nötig!

---

## Schritt 3 — SimBrief einrichten

1. App starten (Schritt 4)
2. Oben rechts **⚙ Einstellungen**
3. SimBrief Pilot ID eintragen (simbrief.com → Account → Pilot ID)
4. Sprache für Ansagen wählen
5. **Speichern**

---

## Schritt 4 — App starten

**Als Browser-App:**
```cmd
start.bat
```
→ öffnet automatisch http://localhost:3000

**Als Electron-App (eigenes Fenster):**
```cmd
electron\start-electron.bat
```

**Desktop-Verknüpfung erstellen:**
→ Doppelklick auf `create-shortcut.vbs`
→ Condor-Icon erscheint auf dem Desktop

---

## Normaler Ablauf

1. MSFS 2024 starten, Fenix A320 am Gate laden
2. Condor Cabin Manager starten
3. **SimBrief OFP importieren** → "⬇ OFP importieren"
4. GSX Pro Ablauf starten (Fuel → Catering → Boarding)
5. App erkennt Boarding automatisch → Ansagen starten

---

## Sprachausgabe (Windows SAPI)

Die App nutzt die eingebauten Windows-Stimmen.
Empfohlene Stimmen (kostenlos in Windows enthalten):

| Sprache | Stimme | Installation |
|---------|--------|-------------|
| Deutsch | Microsoft Hedda | Windows-Einstellungen → Zeit & Sprache → Sprache → Deutsch hinzufügen |
| English GB | Microsoft Hazel | Englisch (GB) als Windows-Sprache installieren |
| English US | Microsoft Zira | Englisch (US) als Windows-Sprache installieren |

**Bessere Stimmen installieren:**
Windows 11: Einstellungen → Zeit & Sprache → Sprache & Region
→ Sprache hinzufügen → Sprachpaket mit "Text-zu-Sprache" herunterladen

---

## Tablet-Zugriff

Das Dashboard ist auch vom Tablet erreichbar:
1. IP-Adresse des PCs herausfinden: `ipconfig` → IPv4-Adresse
2. Im Tablet-Browser öffnen: `http://192.168.x.x:3000`
3. Dashboard ist automatisch synchron mit PC

---

## Fehlerbehebung

**Keine Sprachausgabe:**
- Windows-Einstellungen → Zeit & Sprache → Sprachausgabe prüfen
- Lautstärke und Standardausgabegerät prüfen
- Im Einstellungs-Menü der App: "Stimme testen" klicken

**GSX startet Boarding, App reagiert nicht:**
```cmd
node debug-gsx.js
```
→ zeigt ob LVARs gelesen werden

**SimConnect nicht verbunden:**
- MSFS muss vor der App gestartet sein
- App verbindet automatisch nach dem MSFS-Start

**App startet nicht:**
```cmd
cd flightcabin
node src/app.js
```
→ Fehlermeldung beachten

---

## Einstellungen

| Option | Beschreibung |
|--------|-------------|
| SimBrief Pilot ID | Deine SimBrief-Nummer |
| Ansagesprache | DE, EN-GB, EN-US, FR, ES, IT, NL, TR |
| Zweisprachig | Erst DE dann EN (Lufthansa-Stil) |
| Windows-Stimme | Automatisch oder manuell wählen |
| Sprechgeschwindigkeit | 0.5 (langsam) bis 1.5 (schnell) |
| Auto-Ansagen | Ein/Aus im Dashboard |

---

*Condor Cabin Manager | MSFS 2024 | Fenix A320 | GSX Pro*
