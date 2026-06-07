# Fenix A320 Checkliste — EXE erstellen

## Voraussetzungen
- Node.js installiert
- Projekt-Abhängigkeiten installiert (`npm install`)
- `electron-builder` installiert (`npm install --save-dev electron-builder`)

## Build

**CMD als Administrator öffnen**, dann in den Projektordner navigieren:
cd "C:\Users\dhuber\OneDrive\Dokumente\Meine Projekte\MsFs 24 Checkliste in game\fenix-a320-checkliste\fenix-checklist"


```
cd "C:\...\fenix-checklist"
```

Build starten:

```
npm run build
```

## Ergebnis

Die fertige Installer-Datei liegt nach dem Build unter:

```
dist\Fenix A320 Checkliste Setup 1.0.0.exe
```

## Hinweise

- Build muss **als Administrator** ausgeführt werden (sonst Fehler mit symbolischen Links)
- Der `audio/PA/` Ordner wird automatisch ins Paket aufgenommen
- Version in `package.json` anpassen um eine neue Version zu bauen
