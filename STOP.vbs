' Beendet Bridge und App
Dim shell
Set shell = CreateObject("WScript.Shell")
shell.Run "taskkill /f /im node.exe", 0, True
shell.Run "taskkill /f /im electron.exe", 0, True
MsgBox "Fenix Checkliste beendet.", 64, "Fenix A320"
