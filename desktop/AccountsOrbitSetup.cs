using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class Program
{
    const string AppUrl = "https://bolkarigar.onrender.com/loginpage.html";

    [STAThread]
    static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        var appDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AccountsOrbit");
        var installed = Path.Combine(appDir, "AccountsOrbit.exe");
        var running = Application.ExecutablePath;
        var isInstalledCopy = string.Equals(
            Path.GetFullPath(running),
            Path.GetFullPath(installed),
            StringComparison.OrdinalIgnoreCase);

        if (!isInstalledCopy)
        {
            try
            {
                Directory.CreateDirectory(appDir);
                File.Copy(running, installed, true);
                CreateShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Accounts Orbit.lnk"), installed);
                CreateShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), "Accounts Orbit.lnk"), installed);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Install fail: " + ex.Message, "Accounts Orbit", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }
        }

        LaunchApp();
    }

    static void LaunchApp()
    {
        var browser = FindBrowser();
        if (browser == null)
        {
            Process.Start(new ProcessStartInfo { FileName = AppUrl, UseShellExecute = true });
            return;
        }
        Process.Start(new ProcessStartInfo
        {
            FileName = browser,
            Arguments = "--app=\"" + AppUrl + "\" --window-size=1360,860",
            UseShellExecute = false
        });
    }

    static string FindBrowser()
    {
        var pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        var pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        string[] candidates =
        {
            Path.Combine(pf86, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(pf86, @"Google\Chrome\Application\chrome.exe")
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
