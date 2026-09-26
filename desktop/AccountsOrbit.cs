using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class AccountsOrbit
{
    const string AppUrl = "https://app.accountsorbit.com/dashboard";

    [STAThread]
    static void Main()
    {
        var edge = FindBrowser();
        if (edge == null)
        {
            Process.Start(new ProcessStartInfo { FileName = AppUrl, UseShellExecute = true });
            return;
        }
        var profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AccountsOrbit", "ChromeProfile");
        Directory.CreateDirectory(profile);
        Process.Start(new ProcessStartInfo
        {
            FileName = edge,
            Arguments = "--user-data-dir=\"" + profile + "\" --app=\"" + AppUrl + "\" --window-size=1360,860 --no-first-run --no-default-browser-check",
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
}
