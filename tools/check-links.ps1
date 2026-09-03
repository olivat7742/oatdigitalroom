# Verifies every reference URL in the catalog still resolves.
#
#   pwsh tools/check-links.ps1
#
# Run this after editing PRODUCT_REFERENCES in tools/build-catalog.mjs, and periodically:
# NiCE will reorganise nice.com eventually and these will rot silently.
#
# Why it matters more than a normal link check: these URLs are offered to a visitor under an
# agent reply, specifically so they can bookmark one and read it later. A dead link there is
# worse than no link at all, because the visitor only discovers it is dead after they have
# walked away and come back.
#
# Exits 1 if any link fails, so it can gate a release.

$ProgressPreference = 'SilentlyContinue'

$repoRoot = Split-Path -Parent $PSScriptRoot
$catalogPath = Join-Path $repoRoot 'catalog\demo-catalog.json'

if (-not (Test-Path $catalogPath)) {
  Write-Error "Catalog not found at $catalogPath"
  exit 1
}

$catalog = [System.IO.File]::ReadAllText($catalogPath) | ConvertFrom-Json

$urls = @()
$urls += $catalog.assets.references | Where-Object { $_ } | ForEach-Object { $_.url }
$urls += $catalog.assets | ForEach-Object { $_.source.watchUrl } | Where-Object { $_ }
# The fallbacks hardcoded in app/src/references.ts, checked here so they cannot drift unnoticed.
$urls += 'https://www.nice.com/products'
$urls += 'https://help.nice-incontact.com'

$urls = $urls | Sort-Object -Unique
Write-Host "Checking $($urls.Count) URLs`n"

$bad = @()
foreach ($url in $urls) {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30 -MaximumRedirection 5 -UserAgent 'Mozilla/5.0'
    Write-Host ("  {0,-4} {1}" -f $response.StatusCode, $url)
  } catch {
    $code = 'ERR'
    try { $code = $_.Exception.Response.StatusCode.value__ } catch {}
    Write-Host ("  {0,-4} {1}   <-- FAILED" -f $code, $url) -ForegroundColor Red
    $bad += $url
  }
}

Write-Host ""
if ($bad.Count -gt 0) {
  Write-Host "$($bad.Count) dead link(s). Fix PRODUCT_REFERENCES in tools/build-catalog.mjs, regenerate, and re-run." -ForegroundColor Red
  exit 1
}
Write-Host "All links resolve." -ForegroundColor Green
