' Erstellt Desktop-Verknüpfung für die Checkliste
Dim shell, fso, shortcut, appDir, desktop

Set shell   = CreateObject("WScript.Shell")
Set fso     = CreateObject("Scripting.FileSystemObject")

appDir  = fso.GetParentFolderName(WScript.ScriptFullName)
desktop = shell.SpecialFolders("Desktop")

Set shortcut = shell.CreateShortcut(desktop & "\Fenix A320 Checkliste.lnk")
shortcut.TargetPath       = appDir & "\START.vbs"
shortcut.WorkingDirectory = appDir
shortcut.Description      = "Fenix A320 Checkliste starten"
shortcut.IconLocation     = appDir & "\assets\icon.ico,0"
shortcut.Save

MsgBox "Verknüpfung auf dem Desktop erstellt!" & Chr(13) & Chr(13) & _
       "Doppelklick auf 'Fenix A320 Checkliste' zum Starten.", 64, "Fenix A320"
