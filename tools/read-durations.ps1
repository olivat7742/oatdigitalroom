# Extracts video durations from the media directory into catalog/durations.json.
#
# Node cannot read mp4/mov duration without a media library, and tools/build-catalog.mjs is
# deliberately dependency-free, so durations are extracted here once and committed.
#
#   pwsh tools/read-durations.ps1
#   pwsh tools/read-durations.ps1 -MediaDir "D:\elsewhere\Resources"

param(
  [string]$MediaDir = (Join-Path (Split-Path -Parent (Split-Path -Parent $PSCommandPath)) 'Resources')
)

if (-not (Test-Path $MediaDir)) {
  Write-Error "Media directory not found: $MediaDir"
  exit 1
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$outFile = Join-Path $repoRoot 'catalog\durations.json'

$shell = New-Object -ComObject Shell.Application
$folder = $shell.Namespace((Resolve-Path $MediaDir).Path)

$result = [ordered]@{}
Get-ChildItem $MediaDir -File | Where-Object { $_.Extension -match '^\.(mp4|mov|m4v|webm)$' } | Sort-Object Name | ForEach-Object {
  $item = $folder.ParseName($_.Name)
  # 27 is the System.Media.Duration column, returned as h:mm:ss.
  $raw = $folder.GetDetailsOf($item, 27)
  if ($raw -match '(\d+):(\d{2}):(\d{2})') {
    $seconds = [int]$Matches[1] * 3600 + [int]$Matches[2] * 60 + [int]$Matches[3]
    $result[$_.Name] = $seconds
  } else {
    Write-Warning "Could not read duration for $($_.Name)"
  }
}

$json = $result | ConvertTo-Json -Depth 3
[System.IO.File]::WriteAllText($outFile, $json + "`n")
"Wrote $($result.Count) durations to catalog/durations.json"
