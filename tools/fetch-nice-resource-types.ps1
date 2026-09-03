# Harvests the AUTHORITATIVE content type of every English resource from the nice.com/resources
# listing, into catalog/nice-resource-types.json
#
#   pwsh tools/fetch-nice-resource-types.ps1
#   pwsh tools/fetch-nice-resource-types.ps1 -Types case-studies,white-papers   # a subset
#
# WHY THIS EXISTS
# The individual resource pages do not state their content type: no og:type, no taxonomy in
# embedded JSON, no badge. Typing them from title and description keywords left two thirds
# Unknown. The listing page does know the type, because it filters on it.
#
# THE ONE TRICK THAT MAKES THIS WORK
# https://www.nice.com/resources?types=case-studies returns, as plain HTML, the UNFILTERED
# default page. The filter looks client-side and I wrongly concluded the query param was
# ignored. It is not. The page is a Next.js App Router route, and the filtered render is only
# produced for a React Server Component request, which needs BOTH:
#
#   * the header  RSC: 1
#   * a  _rsc=<anything>  query parameter
#
# Without the _rsc parameter the server returns the unfiltered tree and the header alone
# changes nothing. The value is not validated, so "zzz" works as well as the build hash the
# browser sends. That matters: a hash pinned from one deploy would rot on the next.
#
# WHAT COMES BACK
# text/x-component, the React Flight stream. Cards appear as
#   "href":"/resources/<slug>","className":"resources-card"
# with the type label a little further along in a span, and the page footer carries
#   "total":378,"page":2,"size":9
# which gives the page count without guessing.
#
# COST
# 9 cards a page, 151 pages for the whole English library. About 150 requests instead of the
# 1,411 that fetching each page individually would take.

param(
  [string[]]$Types,
  [int]$DelayMs = 250
)

$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Continue'

$repoRoot = Split-Path -Parent $PSScriptRoot
$outFile = Join-Path $repoRoot 'catalog\nice-resource-types.json'
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
$headers = @{ 'RSC' = '1'; 'Accept' = '*/*' }

# The taxonomy as the site defines it, read from the listing's own filter rather than invented.
# Left is the URL slug, right is the label the card displays.
$taxonomy = [ordered]@{
  'brochure'       = 'Brochure'
  'case-studies'   = 'Case study'
  'datasheets'     = 'Datasheet'
  'demo-videos'    = 'Demo video'
  'ebook'          = 'eBook'
  'infographics'   = 'Infographic'
  'podcasts'       = 'Podcast'
  'product-videos' = 'Product video'
  'reports'        = 'Report'
  'testimonials'   = 'Testimonial'
  'webinars'       = 'Webinar'
  'white-papers'   = 'White paper'
}

if (-not $Types -or $Types.Count -eq 0) { $Types = @($taxonomy.Keys) }

function Get-Listing([string]$type, [int]$page) {
  # _rsc must be present but its value is never checked. See the header comment.
  $url = "https://www.nice.com/resources?types=$type&page=$page&_rsc=zzz"
  (Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 45 -UserAgent $ua -Headers $headers).Content
}

# slug -> list of type labels. A resource may legitimately carry more than one, for example a
# customer story released as both a case study and a testimonial.
$typesBySlug = @{}
$perType = [ordered]@{}
$failedPages = @()

foreach ($type in $Types) {
  $label = $taxonomy[$type]
  if (-not $label) { Write-Host "Skipping unknown type '$type'"; continue }

  try { $first = Get-Listing $type 1 }
  catch { Write-Host "  FAILED $type page 1: $($_.Exception.Message)"; $failedPages += "$type/1"; continue }

  $m = [regex]::Match($first, '"total":(\d+),"page":\d+,"size":(\d+)')
  if (-not $m.Success) { Write-Host "  $type : no total marker, skipping"; continue }

  $total = [int]$m.Groups[1].Value
  $size = [int]$m.Groups[2].Value
  $pages = [math]::Ceiling($total / $size)
  $perType[$label] = $total
  Write-Host ("{0,-16} {1,5} items, {2,3} pages" -f $type, $total, $pages)

  for ($page = 1; $page -le $pages; $page++) {
    $html = if ($page -eq 1) { $first } else {
      try { Start-Sleep -Milliseconds $DelayMs; Get-Listing $type $page }
      catch { Write-Host "  FAILED $type page $page`: $($_.Exception.Message)"; $failedPages += "$type/$page"; $null }
    }
    if (-not $html) { continue }

    foreach ($card in [regex]::Matches($html, '"href":"/resources/([a-z0-9\-]+)","className":"resources-card"')) {
      $slug = $card.Groups[1].Value
      if (-not $typesBySlug.ContainsKey($slug)) { $typesBySlug[$slug] = @() }
      if ($typesBySlug[$slug] -notcontains $label) { $typesBySlug[$slug] += $label }
    }
  }
}

$items = foreach ($slug in ($typesBySlug.Keys | Sort-Object)) {
  [PSCustomObject]@{
    slug  = $slug
    # First is the primary. Order follows the taxonomy order above, which is the site's own.
    type  = $typesBySlug[$slug][0]
    types = $typesBySlug[$slug]
  }
}
$items = @($items)

$payload = [ordered]@{
  source      = 'https://www.nice.com/resources, per-type listing filter, English'
  fetched     = (Get-Date).ToString('yyyy-MM-dd')
  count       = $items.Count
  countByType = ($perType.GetEnumerator() | ForEach-Object { [ordered]@{ type = $_.Key; count = $_.Value } })
  note        = 'Authoritative: these are the content types the site itself assigns and filters on, not inferred from the page text. A resource can carry more than one type; types lists all of them and type is the first.'
  failedPages = @($failedPages)
  items       = $items
}

[System.IO.File]::WriteAllText($outFile, ($payload | ConvertTo-Json -Depth 5) + "`n")

Write-Host ''
Write-Host "Wrote $($items.Count) typed resources to catalog/nice-resource-types.json"
if ($failedPages.Count) { Write-Host "Failed pages: $($failedPages -join ', ')" }
Write-Host ''
$items | Group-Object type | Sort-Object Count -Descending | ForEach-Object { '{0,6}  {1}' -f $_.Count, $_.Name }
