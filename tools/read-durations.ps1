# Extracts video durations from the media directory into catalog/durations.json.
#
# Node cannot read mp4/mov duration without a media library, and tools/build-catalog.mjs is
# deliberately dependency-free, so durations are extracted here once and committed.
#
#   pwsh tools/read-durations.ps1
#   pwsh tools/read-durations.ps1 -MediaDir "D:\elsewhere\Resources"

param(
  # Three levels up from tools/read-durations.ps1, so this lands beside the repository rather
  # than inside it, matching MEDIA_DIR in tools/build-catalog.mjs. It was two levels, which
  # resolved to <repo>/Resources and made the documented command fail every time.
  [string]$MediaDir = (Join-Path (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSCommandPath))) 'Resources')
)

if (-not (Test-Path $MediaDir)) {
  Write-Error "Media directory not found: $MediaDir"
  exit 1
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$outFile = Join-Path $repoRoot 'catalog\durations.json'

$shell = New-Object -ComObject Shell.Application
$root = (Resolve-Path $MediaDir).Path

# Recurse, and key by the path relative to the media root with forward slashes, matching the
# META keys in tools/build-catalog.mjs. The NiCE World vertical assets are filed one folder per
# industry, so a flat listing missed all eleven of them.
#
# Shell.Application resolves details per directory, so there is one Namespace call per folder
# rather than one for the whole tree.
$result = [ordered]@{}
Get-ChildItem $root -File -Recurse |
  Where-Object { $_.Extension -match '^\.(mp4|mov|m4v|webm)$' } |
  Sort-Object FullName |
  ForEach-Object {
    $relative = $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
    $folder = $shell.Namespace($_.DirectoryName)
    $item = $folder.ParseName($_.Name)
    # 27 is the System.Media.Duration column, returned as h:mm:ss.
    $raw = $folder.GetDetailsOf($item, 27)
    if ($raw -match '(\d+):(\d{2}):(\d{2})') {
      $seconds = [int]$Matches[1] * 3600 + [int]$Matches[2] * 60 + [int]$Matches[3]
      $result[$relative] = $seconds
    } else {
      Write-Warning "Could not read duration for $relative"
    }
  }

$json = $result | ConvertTo-Json -Depth 3
[System.IO.File]::WriteAllText($outFile, $json + "`n")
"Wrote $($result.Count) durations to catalog/durations.json"
