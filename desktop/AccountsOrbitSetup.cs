using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows.Forms;

[assembly: AssemblyTitle("Accounts Orbit")]
[assembly: AssemblyProduct("Accounts Orbit")]
[assembly: AssemblyCompany("Accounts Orbit")]
[assembly: AssemblyDescription("Accounts Orbit desktop app")]
[assembly: AssemblyVersion("1.0.4.0")]
[assembly: AssemblyFileVersion("1.0.4.0")]

internal static class Program
{
    const string AppUrl = "https://bolkarigar.onrender.com/loginpage.html";

    [STAThread]
    static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        try { TryUnblock(Application.ExecutablePath); }
        catch { }

        string installed = null;
        try { installed = InstallAppCopy(); }
        catch { }

        try { InstallDesktopShortcut(installed); }
        catch { }

        try
        {
            LaunchApp();
        }
        catch (Exception ex)
        {
            try
            {
                Process.Start(new ProcessStartInfo { FileName = AppUrl, UseShellExecute = true });
            }
            catch
            {
                MessageBox.Show(
                    "Accounts Orbit start nahi ho paya.\n\n" + ex.Message,
                    "Accounts Orbit",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
            }
        }
    }

    static string AppDir()
    {
        return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AccountsOrbit");
    }

    static string InstallAppCopy()
    {
        var dir = AppDir();
        Directory.CreateDirectory(dir);
        var dest = Path.Combine(dir, "AccountsOrbit.exe");
        var running = Application.ExecutablePath;
        if (!string.Equals(Path.GetFullPath(running), Path.GetFullPath(dest), StringComparison.OrdinalIgnoreCase))
            File.Copy(running, dest, true);
        TryUnblock(dest);
        var ico = Path.Combine(dir, "AccountsOrbit.ico");
        try { File.WriteAllBytes(ico, AppIconData.Bytes()); }
        catch
        {
            try
            {
                var beside = Path.Combine(Path.GetDirectoryName(running) ?? "", "icon.ico");
                if (File.Exists(beside)) File.Copy(beside, ico, true);
            }
            catch { }
        }
        return dest;
    }

    static void TryUnblock(string file)
    {
        try { File.Delete(file + ":Zone.Identifier"); }
        catch { }
    }

    static void LaunchApp()
    {
        var browser = FindBrowser();
        var psi = browser == null
            ? new ProcessStartInfo { FileName = AppUrl, UseShellExecute = true }
            : new ProcessStartInfo
            {
                FileName = browser,
                Arguments = "--app=\"" + AppUrl + "\" --window-size=1360,860",
                UseShellExecute = true
            };
        Process.Start(psi);
    }

    static string FindBrowser()
    {
        var pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        var pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string[] candidates =
        {
            Path.Combine(pf86, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(local, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(pf86, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(local, @"Google\Chrome\Application\chrome.exe")
        };
        foreach (var c in candidates)
            if (File.Exists(c)) return c;
        return null;
    }

    static void InstallDesktopShortcut(string installedExe)
    {
        var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        var startMenu = Environment.GetFolderPath(Environment.SpecialFolder.StartMenu);
        string[] stale =
        {
            Path.Combine(desktop, "Accounts Orbit.url"),
            Path.Combine(desktop, "AccountsOrbit.url"),
            Path.Combine(desktop, "Accounts Orbit.lnk"),
            Path.Combine(desktop, "AccountsOrbit.lnk"),
            Path.Combine(startMenu, "Accounts Orbit.url"),
            Path.Combine(startMenu, "AccountsOrbit.url"),
            Path.Combine(startMenu, "Accounts Orbit.lnk"),
            Path.Combine(startMenu, "AccountsOrbit.lnk")
        };
        foreach (var s in stale) TryDelete(s);

        var target = string.IsNullOrEmpty(installedExe) ? Application.ExecutablePath : installedExe;
        var icon = Path.Combine(AppDir(), "AccountsOrbit.ico");
        if (!File.Exists(icon)) icon = target;

        TryCreateShortcut(Path.Combine(desktop, "Accounts Orbit.lnk"), target, "", icon);
        TryCreateShortcut(Path.Combine(startMenu, "Accounts Orbit.lnk"), target, "", icon);
        try { SHChangeNotify(0x08000000, 0, IntPtr.Zero, IntPtr.Zero); } catch { }
    }

    [DllImport("shell32.dll")]
    static extern void SHChangeNotify(int eventId, uint flags, IntPtr item1, IntPtr item2);

    static void TryDelete(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); }
        catch { }
    }

    static void TryCreateShortcut(string lnkPath, string target, string args, string iconPath)
    {
        try
        {
            var lnk = lnkPath.Replace("'", "''");
            var tgt = target.Replace("'", "''");
            var arguments = (args ?? "").Replace("'", "''");
            var icon = (iconPath ?? target).Replace("'", "''");
            var cmd = "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('" + lnk + "'); $s.TargetPath = '" + tgt + "'; $s.Arguments = '" + arguments + "'; $s.IconLocation = '" + icon + ",0'; $s.Description = 'Accounts Orbit'; $s.Save()";
            var p = Process.Start(new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = "-NoProfile -ExecutionPolicy Bypass -Command " + cmd,
                UseShellExecute = false,
                CreateNoWindow = true
            });
            if (p != null) p.WaitForExit(12000);
            if (File.Exists(lnkPath)) return;
        }
        catch { }

        WriteUrlShortcut(Path.ChangeExtension(lnkPath, ".url"), iconPath);
    }

    static void WriteUrlShortcut(string path, string iconPath)
    {
        try
        {
            var body = "[InternetShortcut]\r\nURL=" + AppUrl + "\r\n";
            if (!string.IsNullOrEmpty(iconPath) && File.Exists(iconPath))
                body += "IconFile=" + iconPath + "\r\nIconIndex=0\r\n";
            File.WriteAllText(path, body);
        }
        catch { }
    }
}
