$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$csc = Get-ChildItem "$env:WINDIR\Microsoft.NET\Framework64\v4*\csc.exe" | Sort-Object FullName -Descending | Select-Object -First 1
if (-not $csc) { throw "csc.exe not found" }

$outDir = Join-Path $root "..\public\downloads"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$out = Join-Path $outDir "AccountsOrbit-Setup.exe"
$zip = Join-Path $outDir "AccountsOrbit-Setup.zip"
$ico = Join-Path $root "icon.ico"
Push-Location $root
if (-not (Test-Path (Join-Path $root "node_modules\@resvg\resvg-js"))) {
  npm install --omit=dev --no-fund --no-audit @resvg/resvg-js@2.6.2
}
node (Join-Path $root "make-ico.js")
if ($LASTEXITCODE -ne 0) { throw "make-ico failed" }
Pop-Location

if (-not (Test-Path $ico)) { throw "icon.ico missing" }

$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($ico))
$iconData = @"
internal static class AppIconData
{
    internal static byte[] Bytes()
    {
        return System.Convert.FromBase64String("$b64");
    }
}
"@
$iconDataPath = Join-Path $root "IconData.cs"
Set-Content -Path $iconDataPath -Value $iconData -Encoding ASCII

& $csc.FullName /nologo /target:winexe /optimize+ /win32icon:$ico /out:$out /r:System.Windows.Forms.dll /r:System.Drawing.dll "$root\AccountsOrbitSetup.cs" "$iconDataPath"
if ($LASTEXITCODE -ne 0) { throw "csc failed" }

# Zip mein sirf setup exe — extract ke baad ek hi file
if (Test-Path $zip) { Remove-Item $zip -Force }
$stage = Join-Path $env:TEMP "ao-setup-zip"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stage | Out-Null
Copy-Item $out (Join-Path $stage "AccountsOrbit-Setup.exe")
Copy-Item $ico (Join-Path $stage "icon.ico")
@"
Accounts Orbit — Windows install

1. AccountsOrbit-Setup.exe par double-click karo.
2. Neela screen "Windows protected your PC" aaye to daro mat.
3. Don't run mat dabao.
4. More info dabao, phir Run anyway dabao.
"@ | Set-Content -Path (Join-Path $stage "READ-ME-FIRST.txt") -Encoding UTF8
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip -Force
Remove-Item $stage -Recurse -Force

$marketing = "C:\Users\Dell\Downloads\AccountsOrbit.AO\AccountsOrbit\AccountsOrbit-Update\public"
if (Test-Path $marketing) {
  Copy-Item $zip (Join-Path $marketing "AccountsOrbit-Setup.zip") -Force
  Copy-Item $out (Join-Path $marketing "AccountsOrbit-Setup.exe") -Force
}

$bat = Join-Path $outDir "Open-AccountsOrbit.bat"
if (Test-Path $bat) { Remove-Item $bat -Force }

Write-Host "Built $out"
Get-Item $out, $zip | Format-Table FullName, Length -AutoSize
