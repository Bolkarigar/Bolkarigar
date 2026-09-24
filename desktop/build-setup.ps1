$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$csc = Get-ChildItem "$env:WINDIR\Microsoft.NET\Framework64\v4*\csc.exe" | Sort-Object FullName -Descending | Select-Object -First 1
if (-not $csc) { throw "csc.exe not found" }

$outDir = Join-Path $root "..\public\downloads"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$out = Join-Path $outDir "AccountsOrbit-Setup.exe"
$zip = Join-Path $outDir "AccountsOrbit-Setup.zip"
$ico = Join-Path $root "icon.ico"
$png = Join-Path $root "icon.png"

if (Test-Path $png) {
  Add-Type -AssemblyName System.Drawing
  $src = [System.Drawing.Bitmap]::FromFile($png)
  $size = 256
  $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($src, 0, 0, $size, $size)
  $g.Dispose()
  $src.Dispose()

  $rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $stride = $data.Stride
  $bytes = New-Object byte[] ($stride * $size)
  [Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  $bmp.UnlockBits($data)
  $bmp.Dispose()

  $xor = New-Object byte[] ($stride * $size)
  for ($y = 0; $y -lt $size; $y++) {
    [Array]::Copy($bytes, $y * $stride, $xor, ($size - 1 - $y) * $stride, $stride)
  }
  $andRow = [int][Math]::Ceiling($size / 32.0) * 4
  $and = New-Object byte[] ($andRow * $size)
  $dib = New-Object byte[] (40 + $xor.Length + $and.Length)
  [BitConverter]::GetBytes([int]40).CopyTo($dib, 0)
  [BitConverter]::GetBytes([int]$size).CopyTo($dib, 4)
  [BitConverter]::GetBytes([int]($size * 2)).CopyTo($dib, 8)
  [BitConverter]::GetBytes([int16]1).CopyTo($dib, 12)
  [BitConverter]::GetBytes([int16]32).CopyTo($dib, 14)
  [BitConverter]::GetBytes([int]$xor.Length).CopyTo($dib, 20)
  $xor.CopyTo($dib, 40)
  $and.CopyTo($dib, 40 + $xor.Length)

  $header = New-Object byte[] 22
  [BitConverter]::GetBytes([int16]0).CopyTo($header, 0)
  [BitConverter]::GetBytes([int16]1).CopyTo($header, 2)
  [BitConverter]::GetBytes([int16]1).CopyTo($header, 4)
  $header[6] = 0
  $header[7] = 0
  [BitConverter]::GetBytes([int16]1).CopyTo($header, 10)
  [BitConverter]::GetBytes([int16]32).CopyTo($header, 12)
  [BitConverter]::GetBytes([int]$dib.Length).CopyTo($header, 14)
  [BitConverter]::GetBytes([int]22).CopyTo($header, 18)
  $all = New-Object byte[] ($header.Length + $dib.Length)
  $header.CopyTo($all, 0)
  $dib.CopyTo($all, $header.Length)
  [IO.File]::WriteAllBytes($ico, $all)
}

if (-not (Test-Path $ico)) { throw "icon.ico missing" }

& $csc.FullName /nologo /target:winexe /optimize+ /win32icon:$ico /out:$out /r:System.Windows.Forms.dll /r:System.Drawing.dll "$root\AccountsOrbitSetup.cs"
if ($LASTEXITCODE -ne 0) { throw "csc failed" }

# Zip mein sirf setup exe — extract ke baad ek hi file
if (Test-Path $zip) { Remove-Item $zip -Force }
$stage = Join-Path $env:TEMP "ao-setup-zip"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stage | Out-Null
Copy-Item $out (Join-Path $stage "AccountsOrbit-Setup.exe")
Copy-Item $ico (Join-Path $stage "icon.ico")
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
