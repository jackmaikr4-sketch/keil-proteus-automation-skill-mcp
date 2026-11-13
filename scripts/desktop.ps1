param([Parameter(Mandatory=$true)][string]$Request)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,System.Drawing,System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class DesktopNative {
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr SendMessageTimeout(IntPtr h,uint m,IntPtr w,string l,uint f,uint t,out IntPtr result);
 [DllImport("user32.dll",CharSet=CharSet.Unicode,EntryPoint="SendMessageTimeoutW")] public static extern IntPtr SendMessageRead(IntPtr h,uint m,IntPtr w,StringBuilder l,uint f,uint t,out IntPtr result);
 [DllImport("user32.dll",EntryPoint="SendMessageTimeoutW")] public static extern IntPtr SendMessageRaw(IntPtr h,uint m,IntPtr w,IntPtr l,uint f,uint t,out IntPtr result);
 [DllImport("user32.dll")] public static extern IntPtr GetMenu(IntPtr h);
 [DllImport("user32.dll")] public static extern int GetMenuItemCount(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetSubMenu(IntPtr h,int p);
 [DllImport("user32.dll")] public static extern uint GetMenuItemID(IntPtr h,int p);
 [DllImport("user32.dll")] public static extern uint GetMenuState(IntPtr h,uint p,uint f);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetMenuString(IntPtr h,uint p,StringBuilder b,int max,uint f);
 public static string ReadText(IntPtr h) { var b=new StringBuilder(32768); IntPtr r; SendMessageRead(h,13,(IntPtr)b.Capacity,b,2,2000,out r); return b.ToString(); }
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int n);
 [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT p);
 public struct POINT { public int X,Y; public POINT(int x,int y){X=x;Y=y;} }
 [DllImport("user32.dll")] public static extern void mouse_event(uint f,uint x,uint y,uint d,UIntPtr e);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
 [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a,uint b,bool attach);
 [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
 public struct RECT { public int Left,Top,Right,Bottom; }
}
'@
$r = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Request)) | ConvertFrom-Json
$mutex = [Threading.Mutex]::new($false,'Local\KeilProteusMcpDesktop')
$locked = $false
try {
 try { $locked = $mutex.WaitOne(15000) } catch [Threading.AbandonedMutexException] { $locked=$true }
 if (!$locked) { throw 'Desktop busy: another MCP is operating the UI.' }
 $processName = if ($r.app -eq 'keil') {'UV4'} else {'PDS'}
 $procs = @(Get-Process -Name $processName -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0})
 if ($r.pid) { $procs = @($procs | Where-Object Id -eq $r.pid) }
 if ($procs.Count -ne 1) { throw "Expected one visible $processName window; found $($procs.Count). Specify pid if multiple." }
 $proc = $procs[0]; $h = $proc.MainWindowHandle
 $pc=[Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::ProcessIdProperty,[int]$proc.Id)
 $top=[Windows.Automation.AutomationElement]::RootElement.FindAll([Windows.Automation.TreeScope]::Children,$pc)
 $main=@($top | Where-Object {$_.Current.ControlType -eq [Windows.Automation.ControlType]::Window} | Sort-Object { $_.Current.BoundingRectangle.Width * $_.Current.BoundingRectangle.Height } -Descending)
 if($main.Count -gt 0){$h=[IntPtr]$main[0].Current.NativeWindowHandle}
 if([DesktopNative]::IsIconic($h)){[void][DesktopNative]::ShowWindow($h,9)}
 if ($r.action -ne 'inspect') {
  if($r.maximize){[void][DesktopNative]::ShowWindow($h,3)}
  [uint32]$fp=0
  $ft=[DesktopNative]::GetWindowThreadProcessId([DesktopNative]::GetForegroundWindow(),[ref]$fp)
  $ct=[DesktopNative]::GetCurrentThreadId()
  try {
   [void][DesktopNative]::AttachThreadInput($ct,$ft,$true)
   [void][DesktopNative]::BringWindowToTop($h)
   [void][DesktopNative]::SetForegroundWindow($h)
  } finally {[void][DesktopNative]::AttachThreadInput($ct,$ft,$false)}
  Start-Sleep -Milliseconds 200
  [uint32]$foregroundPid=0
  [void][DesktopNative]::GetWindowThreadProcessId([DesktopNative]::GetForegroundWindow(),[ref]$foregroundPid)
  if ($foregroundPid -ne $proc.Id) {
   $ws=New-Object -ComObject WScript.Shell
   for($attempt=0;$attempt -lt 3 -and $foregroundPid -ne $proc.Id;$attempt++){
    [void]$ws.AppActivate([int]$proc.Id)
    [void][DesktopNative]::SetForegroundWindow($h)
    Start-Sleep -Milliseconds 250
    [void][DesktopNative]::GetWindowThreadProcessId([DesktopNative]::GetForegroundWindow(),[ref]$foregroundPid)
   }
   [void][Runtime.InteropServices.Marshal]::ReleaseComObject($ws)
  }
  if ($foregroundPid -ne $proc.Id) { throw "Cannot verify foreground application (wanted $($proc.Id), found $foregroundPid); no input sent." }
 }
 $root = [Windows.Automation.AutomationElement]::FromHandle($h)
 # Include owned dialogs, which can be separate top-level windows.
 $condition = [Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::ProcessIdProperty,[int]$proc.Id)
 $windows = [Windows.Automation.AutomationElement]::RootElement.FindAll([Windows.Automation.TreeScope]::Children,$condition)
 $all = [Collections.Generic.List[object]]::new()
 foreach ($win in $windows) {
  $all.Add($win)
  $desc=$win.FindAll([Windows.Automation.TreeScope]::Descendants,[Windows.Automation.Condition]::TrueCondition)
  foreach ($el in $desc) { if ($all.Count -lt 1600) {$all.Add($el)} }
 }
 $rect = [DesktopNative+RECT]::new(); [void][DesktopNative]::GetWindowRect($h,[ref]$rect)
 switch ($r.action) {
  'inspect' {
   $items = @(); $i=0
   foreach ($el in $all) {
    try {
     $c=$el.Current; $v=$null; $pat=$null
     if($c.BoundingRectangle.IsEmpty){continue}
     if ($el.TryGetCurrentPattern([Windows.Automation.ValuePattern]::Pattern,[ref]$pat)) {$v=$pat.Current.Value}
     if($c.ClassName -eq 'Edit' -and $c.NativeWindowHandle){$v=[DesktopNative]::ReadText([IntPtr]$c.NativeWindowHandle)}
     $items += @{id=$i;name=$c.Name;automationId=$c.AutomationId;type=$c.ControlType.ProgrammaticName;class=$c.ClassName;enabled=$c.IsEnabled;offscreen=$c.IsOffscreen;value=$v;x=$c.BoundingRectangle.X;y=$c.BoundingRectangle.Y;width=$c.BoundingRectangle.Width;height=$c.BoundingRectangle.Height}
    } catch {}
    $i++
   }
   @{pid=$proc.Id;title=$root.Current.Name;bounds=@{x=$rect.Left;y=$rect.Top;width=$rect.Right-$rect.Left;height=$rect.Bottom-$rect.Top};controls=$items} | ConvertTo-Json -Depth 8 -Compress
  }
  'screenshot' {
   $w=$rect.Right-$rect.Left; $height=$rect.Bottom-$rect.Top
   if ($w -le 0 -or $height -le 0) {throw 'Invalid window bounds'}
   $bmp=[Drawing.Bitmap]::new($w,$height); $g=[Drawing.Graphics]::FromImage($bmp)
   try {$g.CopyFromScreen($rect.Left,$rect.Top,0,0,$bmp.Size); $bmp.Save($r.output,[Drawing.Imaging.ImageFormat]::Png)} finally {$g.Dispose();$bmp.Dispose()}
   @{path=$r.output;pid=$proc.Id;title=$root.Current.Name;bounds=@{x=$rect.Left;y=$rect.Top;width=$w;height=$height};capture='screen_pixels_may_be_occluded'} | ConvertTo-Json -Compress
  }
  'click' {
   if ($r.expectedX -ne $rect.Left -or $r.expectedY -ne $rect.Top -or $r.expectedWidth -ne ($rect.Right-$rect.Left) -or $r.expectedHeight -ne ($rect.Bottom-$rect.Top)) {throw 'Window moved since screenshot; capture again.'}
   if ($r.x -lt 0 -or $r.y -lt 0 -or $r.x -ge ($rect.Right-$rect.Left) -or $r.y -ge ($rect.Bottom-$rect.Top)) {throw 'Coordinates outside application window'}
   $point=[DesktopNative+POINT]::new($rect.Left+[int]$r.x,$rect.Top+[int]$r.y)
   [uint32]$pointPid=0
   [void][DesktopNative]::GetWindowThreadProcessId([DesktopNative]::WindowFromPoint($point),[ref]$pointPid)
   if($pointPid -ne $proc.Id){throw 'Click point is occluded by another application; capture again.'}
   [void][DesktopNative]::SetCursorPos($rect.Left+[int]$r.x,$rect.Top+[int]$r.y)
   $down=2; $up=4; if($r.button -eq 'right'){$down=8;$up=16}
   $count=1; if($r.double){$count=2}
   for($j=0;$j -lt $count;$j++){[DesktopNative]::mouse_event($down,0,0,0,[UIntPtr]::Zero);[DesktopNative]::mouse_event($up,0,0,0,[UIntPtr]::Zero);Start-Sleep -Milliseconds 80}
   '{"inputSent":true,"verified":false}'
  }
  'keys' {[Windows.Forms.SendKeys]::SendWait([string]$r.keys); '{"inputSent":true,"verified":false}'}
  'text' {
   $escaped=([string]$r.text -replace '([+^%~(){}\[\]])','{$1}')
   [Windows.Forms.SendKeys]::SendWait($escaped)
   '{"inputSent":true,"verified":false}'
  }
  {$_ -in 'invoke','set_value'} {
   $matches=@($all | Where-Object {($_.Current.Name -eq $r.name -or !$r.name) -and ($_.Current.AutomationId -eq $r.automationId -or !$r.automationId) -and ($_.Current.ClassName -eq $r.class -or !$r.class) -and ($_.Current.ControlType.ProgrammaticName -eq $r.type -or !$r.type) -and !$_.Current.IsOffscreen})
   if ($matches.Count -ne 1) {throw "Selector matched $($matches.Count) controls; require exactly one."}
   $el=$matches[0]
   if($r.action -eq 'set_value') {
    $pat=$null
    if($el.TryGetCurrentPattern([Windows.Automation.ValuePattern]::Pattern,[ref]$pat)){$pat.SetValue([string]$r.value);$actual=$pat.Current.Value}
    elseif($el.Current.ClassName -eq 'Edit'){
     $eh=[IntPtr]$el.Current.NativeWindowHandle;$res=[IntPtr]::Zero
     [void][DesktopNative]::SendMessageTimeout($eh,12,[IntPtr]::Zero,[string]$r.value,2,2000,[ref]$res)
     $actual=[DesktopNative]::ReadText($eh)
    }else{throw 'Control has no writable value'}
    @{verified=($actual -eq [string]$r.value);value=$actual} | ConvertTo-Json -Compress
   } else {
    $pat=$null
    if($el.TryGetCurrentPattern([Windows.Automation.InvokePattern]::Pattern,[ref]$pat)) {$pat.Invoke()}
    elseif($el.TryGetCurrentPattern([Windows.Automation.SelectionItemPattern]::Pattern,[ref]$pat)) {$pat.Select()}
    elseif($el.TryGetCurrentPattern([Windows.Automation.ExpandCollapsePattern]::Pattern,[ref]$pat)) {$pat.Expand()}
    elseif($el.Current.ClassName -eq 'Button'){$res=[IntPtr]::Zero;[void][DesktopNative]::SendMessageTimeout([IntPtr]$el.Current.NativeWindowHandle,245,[IntPtr]::Zero,$null,2,2000,[ref]$res)}
    else {throw 'Control has no supported invoke pattern; use screenshot coordinates.'}
    '{"inputSent":true,"verified":false}'
   }
  }
  {$_ -in 'menus','menu'} {
   function ReadMenus([IntPtr]$menu,[string]$prefix) {
    $count=[DesktopNative]::GetMenuItemCount($menu)
    for($mi=0;$mi -lt $count;$mi++){
     $sb=[Text.StringBuilder]::new(512);[void][DesktopNative]::GetMenuString($menu,$mi,$sb,512,1024)
     $name=$sb.ToString();$sub=[DesktopNative]::GetSubMenu($menu,$mi);$state=[DesktopNative]::GetMenuState($menu,$mi,1024)
     if($sub -ne [IntPtr]::Zero){
      $refresh=[IntPtr]::Zero
      [void][DesktopNative]::SendMessageRaw($h,279,$sub,[IntPtr]$mi,2,2000,[ref]$refresh)
      ReadMenus $sub ($prefix+$name+'/')
     }
     elseif($name){@{name=$name;path=$prefix+$name;command=[DesktopNative]::GetMenuItemID($menu,$mi);enabled=(($state -band 3) -eq 0);checked=(($state -band 8) -ne 0)}}
    }
   }
   $menus=@(ReadMenus ([DesktopNative]::GetMenu($h)) '')
   if($r.action -eq 'menus'){ConvertTo-Json -InputObject $menus -Depth 5 -Compress}
   else{
    $match=@($menus|Where-Object {$_.command -eq $r.command -and $_.enabled})
    if($match.Count -ne 1){throw 'Menu command missing, disabled or ambiguous'}
    $res=[IntPtr]::Zero;[void][DesktopNative]::SendMessageTimeout($h,273,[IntPtr][int]$r.command,$null,2,2000,[ref]$res)
    '{"inputSent":true,"verified":false}'
   }
  }
  default {throw 'Unknown desktop action'}
 }
} catch { @{error=$_.Exception.Message} | ConvertTo-Json -Compress; exit 1 }
finally {if($locked){$mutex.ReleaseMutex()};$mutex.Dispose()}
