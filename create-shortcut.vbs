' Condor Cabin Manager — Desktop-Verknüpfung erstellen
' Doppelklick auf diese Datei um die Verknüpfung zu erstellen

Set oWS     = WScript.CreateObject("WScript.Shell")
Set oFSO    = WScript.CreateObject("Scripting.FileSystemObject")

' Pfad dieser VBS-Datei = Projektordner
Dim appDir
appDir = oFSO.GetParentFolderName(WScript.ScriptFullName)

' Pfade
Dim electronBat
Dim iconPath
Dim desktopPath
Dim linkPath

electronBat = appDir & "\electron\start-electron.bat"
iconPath    = appDir & "\src\public\icon.ico"
desktopPath = oWS.SpecialFolders("Desktop")
linkPath    = desktopPath & "\Condor Cabin Manager.lnk"

' Prüfen ob start-electron.bat existiert
If Not oFSO.FileExists(electronBat) Then
  MsgBox "Fehler: start-electron.bat nicht gefunden!" & vbCrLf & _
         electronBat, vbCritical, "Condor Cabin Manager"
  WScript.Quit
End If

' Verknüpfung erstellen
Dim oLink
Set oLink = oWS.CreateShortcut(linkPath)

oLink.TargetPath       = electronBat
oLink.WorkingDirectory = appDir
oLink.Description      = "Condor Cabin Manager — MSFS 2024 | Fenix A320 | GSX Pro"
oLink.WindowStyle      = 7   ' Minimiert starten (Konsole im Hintergrund)

' Icon setzen wenn vorhanden
If oFSO.FileExists(iconPath) Then
  oLink.IconLocation = iconPath & ", 0"
End If

oLink.Save

' Erfolgsmeldung
MsgBox "Desktop-Verknüpfung wurde erstellt!" & vbCrLf & vbCrLf & _
       "Condor Cabin Manager" & vbCrLf & _
       "Doppelklick auf das Icon startet die App.", _
       vbInformation, "Condor Cabin Manager"
