//go:build windows
package main
import ("encoding/base64";"encoding/binary";"fmt";"os";"os/exec";"strings";"unicode/utf16")
func runTray() {
 script:=fmt.Sprintf(`Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$parentId = %d
$root = 'http://127.0.0.1:38765'
$context = New-Object System.Windows.Forms.ApplicationContext
$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = [System.Drawing.SystemIcons]::Application
$tray.Text = 'Pink Bunny - YouTube Now Playing'
$tray.Visible = $true
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$settings = $menu.Items.Add('Open Pink Bunny settings')
$preview = $menu.Items.Add('Preview OBS player')
$menu.Items.Add('-') | Out-Null
$quit = $menu.Items.Add('Exit Pink Bunny')
$settings.add_Click({ Start-Process ($root + '/setup') })
$preview.add_Click({ Start-Process ($root + '/?demo') })
$quit.add_Click({
 $tray.Visible = $false
 try { [System.Diagnostics.Process]::GetProcessById($parentId).Kill() } catch {}
 $context.ExitThread()
})
$tray.add_DoubleClick({ Start-Process ($root + '/setup') })
$tray.ContextMenuStrip = $menu
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 5000
$timer.add_Tick({
 try { $p = [System.Diagnostics.Process]::GetProcessById($parentId); if ($p.HasExited) { $context.ExitThread() } }
 catch { $context.ExitThread() }
})
$timer.Start()
try { [System.Windows.Forms.Application]::Run($context) }
finally { $timer.Stop(); $timer.Dispose(); $tray.Visible = $false; $tray.Dispose(); $menu.Dispose() }
`,os.Getpid())
 cmd:=exec.Command("powershell.exe","-NoProfile","-NonInteractive","-STA","-WindowStyle","Hidden","-EncodedCommand",encodePS(script))
 _=cmd.Start()
}
func encodePS(s string)string{units:=utf16.Encode([]rune(strings.TrimSpace(s)));bytes:=make([]byte,len(units)*2);for i,v:=range units{binary.LittleEndian.PutUint16(bytes[i*2:],v)};return base64.StdEncoding.EncodeToString(bytes)}
