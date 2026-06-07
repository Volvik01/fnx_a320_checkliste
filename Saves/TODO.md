# Condor Cabin Manager — TODO

## 🎙 Sprachausgabe

### Qualität & Natürlichkeit
- [ ] Pausen zwischen Sätzen (SSML oder manuelle Delays zwischen Satz-Chunks)
- [ ] Satzzeichen optimieren für natürlichere Betonung
- [ ] Flugnummern als Einzelziffern sprechen ("eins-null-drei-sieben" statt "1037")
- [ ] Destinations-Namen auf Deutsch aussprechen (LEPA → "Palma de Mallorca")

### Condor-Spezifisch
- [ ] Optionaler Purser-Name in Begrüßung ("Ich bin Ihr Purser Max Müller")
- [ ] Condor-typische Formulierungen überarbeiten (weniger Lufthansa-Stil)

### Workflow
- [ ] Ansagen-Warteschlange — zweite Ansage wartet bis erste fertig ist
- [ ] Wiederholungssperre — gleiche Ansage nicht 2x innerhalb von 5 Minuten
- [ ] Notfall-Ansagen (Turbulenz) unterbrechen laufende Ansagen sofort

### Zwei-Kanal-Betrieb
- [ ] Kapitäns-Ansagen vs Kabinen-Ansagen — anderer Stil, andere Stimme
- [ ] PA-Knacken als Audio-Intro vor jeder Ansage simulieren

### Timing
- [ ] Boarding-Ansagen mit realistischer Verzögerung (30-60s nach GSX-Start)
- [ ] Reiseflug-Ansage erst wenn stabil (Vertikalgeschwindigkeit < 50 ft/min für 30s)

---

## 🛫 GSX / SimConnect
- [ ] Deboarding-Erkennung (FSDT_GSX_DEBOARDING_STATE)
- [ ] Catering-Status im Dashboard anzeigen
- [ ] Fuel-Status im Dashboard anzeigen

## 🗺 Sitzplan
- [ ] Echte Sitzplatznummern von Fenix A320 übernehmen (falls LVAR verfügbar)
- [ ] Sitzplan-Konfiguration in Einstellungen (Business-Reihen anpassbar)

## ⚙ Allgemein
- [ ] Update-Mechanismus (neue ZIP automatisch erkennen)
- [ ] Logs-Ansicht im Dashboard
