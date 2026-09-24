using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

[assembly: AssemblyTitle("Accounts Orbit Setup")]
[assembly: AssemblyProduct("Accounts Orbit")]
[assembly: AssemblyCompany("Accounts Orbit")]
[assembly: AssemblyDescription("Accounts Orbit desktop installer")]
[assembly: AssemblyVersion("1.0.1.0")]
[assembly: AssemblyFileVersion("1.0.1.0")]

internal static class Program
{
    const string AppUrl = "https://bolkarigar.onrender.com/loginpage.html";

    [STAThread]
    static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        try
        {
            var running = Application.ExecutablePath;
            TryUnblock(running);

            var appDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AccountsOrbit");
            var installed = Path.Combine(appDir, "AccountsOrbit.exe");
            var isInstalledCopy = string.Equals(
                Path.GetFullPath(running),
                Path.GetFullPath(installed),
                StringComparison.OrdinalIgnoreCase);

            if (!isInstalledCopy)
            {
                Directory.CreateDirectory(appDir);
                File.Copy(running, installed, true);
                TryUnblock(installed);
                try
                {
                    CreateShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Accounts Orbit.lnk"), installed);
                    CreateShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), "Accounts Orbit.lnk"), installed);
                }
                catch { /* shortcut optional — app phir bhi khule */ }
            }

            LaunchApp();
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                "Accounts Orbit start nahi ho paya.\n\n" + ex.Message +
                "\n\nAgar Windows 'protected your PC' dikhaye to More info → Run anyway dabao.",
                "Accounts Orbit",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
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

    static void CreateShortcut(string lnkPath, string target)
    {
        var lnk = lnkPath.Replace("'", "''");
        var tgt = target.Replace("'", "''");
        var dir = Path.GetDirectoryName(target).Replace("'", "''");
        var cmd = "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('" + lnk + "'); $s.TargetPath = '" + tgt + "'; $s.WorkingDirectory = '" + dir + "'; $s.Description = 'Accounts Orbit'; $s.Save()";
        var p = Process.Start(new ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = "-NoProfile -ExecutionPolicy Bypass -Command " + cmd,
            UseShellExecute = false,
            CreateNoWindow = true
        });
        if (p != null) p.WaitForExit(15000);
    }
}
