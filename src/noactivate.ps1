param([string]$hwnd)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern int GetWindowLong(IntPtr hwnd, int index);
    [DllImport("user32.dll")]
    public static extern int SetWindowLong(IntPtr hwnd, int index, int newStyle);
    public const int GWL_EXSTYLE = -20;
    public const int WS_EX_NOACTIVATE = 0x08000000;
}
"@
$h = [IntPtr][long]$hwnd
$style = [Win32]::GetWindowLong($h, [Win32]::GWL_EXSTYLE)
[Win32]::SetWindowLong($h, [Win32]::GWL_EXSTYLE, $style -bor [Win32]::WS_EX_NOACTIVATE)
