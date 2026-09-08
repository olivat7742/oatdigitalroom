# Exports every slide of the built deck to PNG, so the layout can be checked by looking at it
# rather than by reasoning about EMU arithmetic.
#
#   powershell -File tools\deck\render-deck.ps1 -OutDir <somewhere>
#
# Text overflow in generated DrawingML is invisible until rendered: PowerPoint simply draws the
# overrun past the shape, or clips it, and neither shows up in the XML. Every layout bug found
# while building this deck was found here.
#
# Needs PowerPoint installed. It drives the real application through COM, so it is the same
# renderer the audience will use.

param(
  [string]$File = '',
  [string]$OutDir = '',
  [int]$Width = 1600,
  # Also write docs\NiCE-Digital-Room.pdf. PowerPoint is already open at this point, so the
  # export is nearly free, and it keeps the PDF from drifting behind the deck it came from.
  [switch]$Pdf
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent (Split-Path -Parent $here)
if ($File -eq '') { $File = Join-Path $repoRoot 'docs\NiCE-Digital-Room.pptx' }
if ($OutDir -eq '') { $OutDir = Join-Path $env:TEMP 'deck-render' }

if (-not (Test-Path $File)) { Write-Error "Deck not found: $File"; exit 1 }

if (Test-Path $OutDir) { Remove-Item $OutDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$ppt = New-Object -ComObject PowerPoint.Application
# Opening ReadOnly with WithWindow=0 keeps the export off screen. msoTrue/msoFalse are 1/0.
$pres = $ppt.Presentations.Open($File, 1, 0, 0)
$n = $pres.Slides.Count
for ($i = 1; $i -le $n; $i++) {
  $target = Join-Path $OutDir ('slide{0:d2}.png' -f $i)
  $pres.Slides.Item($i).Export($target, 'PNG', $Width, [int]($Width * 6858000 / 12192000))
}
$pdfPath = ''
if ($Pdf) {
  $pdfPath = [System.IO.Path]::ChangeExtension($File, 'pdf')
  # SaveCopyAs with 32 (ppSaveAsPDF), NOT ExportAsFixedFormat. The latter has sixteen optional
  # parameters and Windows PowerShell 5.1 cannot bind the two-argument form against a late-bound
  # COM object: it fails with "Cannot convert the 2 value of type int to type Object".
  # SaveCopyAs takes three simple arguments and, unlike SaveAs, leaves the open read-only
  # presentation pointing at the .pptx rather than at the PDF it just wrote.
  if (Test-Path $pdfPath) { Remove-Item $pdfPath -Force }
  $pres.SaveCopyAs($pdfPath, 32)
}

$pres.Close()
$ppt.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null

Write-Host "Exported $n slides to $OutDir"
if ($pdfPath -ne '') { Write-Host "Wrote $pdfPath" }
