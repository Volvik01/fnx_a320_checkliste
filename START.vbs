' ═══════════════════════════════════════════════
' FENIX A320 CHECKLISTE – Unsichtbarer Start
' Startet Bridge + App ohne CMD-Fenster
' ═══════════════════════════════════════════════

Dim shell, fso, appDir

Set shell = CreateObject("WScript.Shell")
Set fso   = CreateObject("Scripting.FileSystemObject")

' Pfad zu diesem Script
appDir = fso.GetParentFolderName(WScript.ScriptFullName)

' node_modules prüfen und ggf. installieren (einmalig, mit Fenster)
If Not fso.FolderExists(appDir & "\bridge\node_modules\ws") Then
  shell.Run "cmd /c cd /d """ & appDir & "\bridge"" && npm install", 1, True
End If
If Not fso.FolderExists(appDir & "\node_modules\electron") Then
  shell.Run "cmd /c cd /d """ & appDir & """ && npm install", 1, True
End If

' Bridge unsichtbar starten (0 = kein Fenster)
shell.Run "cmd /c cd /d """ & appDir & "\bridge"" && node bridge.js", 0, False

' Kurz warten damit Bridge starten kann
WScript.Sleep 2000

' Electron App starten
shell.Run "cmd /c cd /d """ & appDir & """ && npm start", 0, False
