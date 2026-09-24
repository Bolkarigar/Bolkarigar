$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$csc = Get-ChildItem "$env:WINDIR\Microsoft.NET\Framework64\v4*\csc.exe" | Sort-Object FullName -Descending | Select-Object -First 1
if (-not $csc) { throw "csc.exe not found" }

$outDir = Join-Path $root "..\public\downloads"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$out = Join-Path $outDir "AccountsOrbit-Setup.exe"

& $csc.FullName /nologo /target:winexe /optimize+ /out:$out /r:System.Windows.Forms.dll /r:System.Drawing.dll "$root\AccountsOrbitSetup.cs"
if ($LASTEXITCODE -ne 0) { throw "csc failed" }
Write-Host "Built $out"
Get-Item $out | Format-List FullName, Length
