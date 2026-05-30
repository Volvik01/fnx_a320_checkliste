# Fenix A320 – Checklisten-App
### MSFS 2024 Overlay · Phase 1

---

## Was ist das?

Eine schwebende Checklisten-App für den Fenix A320 im MSFS 2024.
Das Fenster bleibt immer über dem Simulator, genau wie GSX Pro.

---

## Installation (einmalig)

### Schritt 1 – Node.js installieren
→ https://nodejs.org/de  
Einfach herunterladen und installieren (LTS-Version empfohlen).

### Schritt 2 – Diesen Ordner irgendwo speichern
z.B. `C:\MSFS-Tools\fenix-checklist\`

### Schritt 3 – Fertig!

---

## Starten

**Doppelklick auf `START.bat`**

Beim ersten Start werden automatisch die nötigen Pakete installiert.
Danach erscheint das Checklist-Fenster über dem Sim.

---

## Bedienung

| Aktion | Beschreibung |
|--------|-------------|
| **Klick auf Item** | Abhaken / rückgängig |
| **Tab oben** | Phase wechseln |
| **RESET** | Aktuelle Phase zurücksetzen |
| **− Knopf** | Minimieren |
| **× Knopf** | Schließen |

Das Fenster kann frei auf dem Bildschirm verschoben werden.

---

## Phasen der Checkliste

1. **Cockpit Prep** – Batterien, ADIRS, Overhead
2. **Before Start** – Fuel, Doors, Parkbremse
3. **Engine Start** – APU, Triebwerke
4. **After Start** – Klappen, Trimmung
5. **Taxi** – Licht, Transponder
6. **Line-Up** – Vor dem Start
7. **Climb** – Fahrwerk, Klappen, Steigflug
8. **Descent/Approach** – Anflugvorbereitung
9. **Shutdown** – Parkposition, Abschalten

---

## L-VAR Badges (Phase 2 – noch nicht aktiv)

Items mit dem `L-VAR` Badge werden in Zukunft automatisch abgehakt,
sobald die Bridge zum Simulator gebaut ist.

**Dafür musst du noch recherchieren:**
- Gehe in den **Fenix Discord** → Kanal `#developers` oder `#tools`
- Suche nach: „L-VAR list", „local variables", „SimConnect"
- Oder nutze **FSUIPC** → Window → LVar Viewer → alle aktiven Variablen anzeigen

Die Platzhalter in `src/index.html` (Abschnitt `CHECKLISTS`) ersetzen:
```javascript
{ id: 'bat1', action: 'BAT 1', value: 'ON', lvar: 'S_OH_ELEC_BAT_1', lval: 1 },
//                                                  ↑ Hier echten L-VAR Namen eintragen
```

---

## Nächste Schritte (Phase 2)

- [ ] Node.js SimConnect Bridge einbauen
- [ ] L-VARs automatisch lesen
- [ ] Items automatisch abhaken wenn L-VAR = Sollwert
- [ ] Fenster-Position speichern

---

## Technologie

- **Electron** – Desktop-App auf Basis von HTML/JS
- **HTML / CSS / JavaScript** – Die gesamte Oberfläche
- Keine externen Dienste, keine Cloud, läuft komplett lokal

---

*Erstellt als Basis-Paket – bereit für Phase 2 (SimConnect)*
