using System;
using System.Runtime.InteropServices;
using System.Text;
public class DesktopNative
{
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr SendMessageTimeout(IntPtr h, uint m, IntPtr w, string l, uint f, uint t, out IntPtr result);
    [DllImport("user32.dll", CharSet = CharSet.Unicode, EntryPoint = "SendMessageTimeoutW")] public static extern IntPtr SendMessageRead(IntPtr h, uint m, IntPtr w, StringBuilder l, uint f, uint t, out IntPtr result);
    [DllImport("user32.dll", EntryPoint = "SendMessageTimeoutW")] public static extern IntPtr SendMessageRaw(IntPtr h, uint m, IntPtr w, IntPtr l, uint f, uint t, out IntPtr result);
    [DllImport("user32.dll")] public static extern IntPtr GetMenu(IntPtr h);
    [DllImport("user32.dll")] public static extern int GetMenuItemCount(IntPtr h);
    [DllImport("user32.dll")] public static extern IntPtr GetSubMenu(IntPtr h, int p);
    [DllImport("user32.dll")] public static extern uint GetMenuItemID(IntPtr h, int p);
    [DllImport("user32.dll")] public static extern uint GetMenuState(IntPtr h, uint p, uint f);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetMenuString(IntPtr h, uint p, StringBuilder b, int max, uint f);
    public static string ReadText(IntPtr h)
    {
        var b = new StringBuilder(32768);
        IntPtr r;
        SendMessageRead(h, 13, (IntPtr)b.Capacity, b, 2, 2000, out r);
        return b.ToString();
    }
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT p);
    public struct POINT
    {
        public int X, Y; public POINT(int x, int y)
        {
            X = x;
            Y = y;
        }
    }
    [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, UIntPtr e);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool attach);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
    public struct RECT
    {
        public int Left, Top, Right, Bottom;
    }
}
