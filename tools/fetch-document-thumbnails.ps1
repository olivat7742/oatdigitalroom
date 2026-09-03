# Fetches the og:image of every curated document into catalog/document-thumbnails.json
#
#   powershell -File tools\fetch-document-thumbnails.ps1
#   powershell -File tools\fetch-document-thumbnails.ps1 -Force   # re-fetch all
#
# WHY A SEPARATE FILE
# The thumbnail is the one thing about a document that cannot be derived: the og:image path on
# resources.nice.com is unpredictable, so it has to be read from the page. Caching it here keeps
# tools/build-catalog.mjs offline and deterministic, which matters because the build refuses to
# write a partial catalog and a network wobble mid-build should not be able to cause that.
#
# Only the curated documents are fetched, currently a couple of dozen, not all 1,414 resources.
# Resumable: slugs already in the output are skipped unless -Force.

param(
  [switch]$Force,
  [int]$DelayMs = 200
)

$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Continue'

$repoRoot = Split-Path -Parent $PSScriptRoot
$curationFile = Join-Path $repoRoot 'catalog\document-curation.json'
$enrichedFile = Join-Path $repoRoot 'catalog\nice-resources-enriched.json'
$outFile = Join-Path $repoRoot 'catalog\document-thumbnails.json'
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

foreach ($f in @($curationFile, $enrichedFile)) {
  if (-not (Test-Path $f)) { Write-Error "Missing $f"; exit 1 }
}

$curation = [System.IO.File]::ReadAllText($curationFile) | ConvertFrom-Json
$enriched = [System.IO.File]::ReadAllText($enrichedFile) | ConvertFrom-Json

$urlBySlug = @{}
foreach ($item in $enriched.items) { $urlBySlug[$item.slug] = $item.url }

$thumbs = @{}
if ((Test-Path $outFile) -and -not $Force) {
  $existing = [System.IO.File]::ReadAllText($outFile) | ConvertFrom-Json
  foreach ($p in $existing.thumbnails.PSObject.Properties) { $thumbs[$p.Name] = $p.Value }
  Write-Host "Resuming: $($thumbs.Count) already known"
}

$fetched = 0
$missing = @()

foreach ($doc in $curation.documents) {
  if ($thumbs.ContainsKey($doc.slug)) { continue }

  $url = $urlBySlug[$doc.slug]
  if (-not $url) {
    # A curated slug that is not in the enriched set is a curation error, not a network problem.
    Write-Host "  NOT IN ENRICHED SET: $($doc.slug)"
    $missing += $doc.slug
    continue
  }

  try {
    $html = (Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 40 -UserAgent $ua).Content
    $m = [regex]::Match($html, '<meta[^>]+property="og:image"[^>]+content="([^"]+)"')
    if (-not $m.Success) {
      $m = [regex]::Match($html, '<meta[^>]+content="([^"]+)"[^>]+property="og:image"')
    }
    if ($m.Success) {
      $thumbs[$doc.slug] = [System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value)
      $fetched++
      Write-Host "  ok  $($doc.slug)"
    } else {
      # The generic NiCE logo card is worse than no thumbnail, and no thumbnail is handled by
      # the renderer, so record the absence rather than a placeholder.
      Write-Host "  no og:image  $($doc.slug)"
      $missing += $doc.slug
    }
  } catch {
    Write-Host "  FAILED $($doc.slug): $($_.Exception.Message)"
    $missing += $doc.slug
  }
  Start-Sleep -Milliseconds $DelayMs
}

$ordered = [ordered]@{}
foreach ($k in ($thumbs.Keys | Sort-Object)) { $ordered[$k] = $thumbs[$k] }

$payload = [ordered]@{
  source     = 'og:image of each curated document page on www.nice.com'
  fetched    = (Get-Date).ToString('yyyy-MM-dd')
  count      = $ordered.Count
  note       = 'Cached so that tools/build-catalog.mjs stays offline and deterministic. A slug absent here simply has no thumbnail and the renderer falls back to a typographic card.'
  thumbnails = $ordered
}

[System.IO.File]::WriteAllText($outFile, ($payload | ConvertTo-Json -Depth 4) + "`n")

Write-Host ''
Write-Host "Fetched $fetched new, $($ordered.Count) total, of $($curation.documents.Count) curated documents"
if ($missing.Count) { Write-Host "Without a thumbnail: $($missing -join ', ')" }
