# Harvests the AUTHORITATIVE facets of every English resource on nice.com/resources into
# catalog/nice-resource-facets.json: content type, solution category and industry.
#
#   powershell -File tools\fetch-nice-resource-facets.ps1
#   powershell -File tools\fetch-nice-resource-facets.ps1 -Facets industries   # one facet
#
# Supersedes tools/fetch-nice-resource-types.ps1, which did the content type alone.
#
# WHY THIS EXISTS
# The individual resource pages state none of this: no og:type, no taxonomy in embedded JSON,
# no badges. Inferring from title and description keywords left two thirds of the library
# untyped. The listing knows all three, because it filters on all three.
#
# THE TWO TRICKS THAT MAKE THIS WORK
#
# 1. PLURAL PARAMETER NAMES. It is  ?types= / ?categories= / ?industries=  and NOT the
#    singular forms, even though the <select> elements are named type, category and industry.
#    This is a trap, not a detail: a singular name is not rejected, it is ignored, and the
#    server returns the full unfiltered 1,314. That looks like a working request with a
#    suspiciously round answer, and it is what led me to conclude the filter was client-side
#    and the query string ignored. It is neither.
#
# 2. RSC HEADER *AND* _rsc PARAMETER, TOGETHER. The route is a Next.js App Router page, and
#    the filtered render is only produced for a React Server Component request. That needs
#    the header  RSC: 1  AND a  _rsc=<anything>  query parameter. Either alone returns the
#    unfiltered tree. The value is never validated, so a literal "zzz" works as well as the
#    build hash the browser sends. Do not pin the real hash: it changes on every deploy.
#
# WHAT COMES BACK
# text/x-component, the React Flight stream. Cards appear as
#   "href":"/resources/<slug>","className":"resources-card"
# and the footer carries  "total":378,"page":2,"size":9  which gives the page count outright,
# so nothing here guesses how far to paginate.
#
# COST
# 9 cards a page. Roughly 400 requests for all three facets, against the 1,411 that fetching
# every resource page individually costs, and those pages do not even carry the answer.
#
# WHAT THIS CANNOT TELL YOU
# The unfiltered listing holds 1,314 resources while the sitemap has 1,411 English ones. About
# a hundred resources are absent from the listing entirely and so have no facets here at all.
# That is a gap in the site's own data. Absence from this file means "the site does not say",
# never "the resource has no industry".

param(
  [ValidateSet('types', 'categories', 'industries')]
  [string[]]$Facets = @('types', 'categories', 'industries'),
  [int]$DelayMs = 250
)

$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Continue'

$repoRoot = Split-Path -Parent $PSScriptRoot
$outFile = Join-Path $repoRoot 'catalog\nice-resource-facets.json'
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
$headers = @{ 'RSC' = '1'; 'Accept' = '*/*' }

# The query parameter for each facet, and the key its term list appears under in the Flight
# payload. "terms" is the content type, named generically because it is the filter's default.
$facetSpec = [ordered]@{
  'types'      = @{ param = 'types'; payloadKey = 'terms' }
  'categories' = @{ param = 'categories'; payloadKey = 'categories' }
  'industries' = @{ param = 'industries'; payloadKey = 'industries' }
}

function Get-Listing([string]$query) {
  # _rsc must be present but its value is never checked. See the header comment.
  $url = "https://www.nice.com/resources?$query&_rsc=zzz"
  (Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 45 -UserAgent $ua -Headers $headers).Content
}

function Get-Total([string]$html) {
  $m = [regex]::Match($html, '"total":(\d+),"page":\d+,"size":(\d+)')
  if ($m.Success) { @{ total = [int]$m.Groups[1].Value; size = [int]$m.Groups[2].Value } } else { $null }
}

function Get-Cards([string]$html) {
  [regex]::Matches($html, '"href":"/resources/([a-z0-9\-]+)","className":"resources-card"') |
    ForEach-Object { $_.Groups[1].Value }
}

# Read the taxonomies from the page rather than hardcoding them, so a term added or renamed on
# the site is picked up instead of silently missed.
Write-Host 'Reading taxonomies from the listing...'
$root = Get-Listing 'page=1'
$vocab = [ordered]@{}
foreach ($facet in $facetSpec.Keys) {
  $key = $facetSpec[$facet].payloadKey
  $m = [regex]::Match($root, ('"' + $key + '":\[(.*?)\]'))
  if (-not $m.Success) { Write-Host "  WARNING: no '$key' term list found, skipping $facet"; continue }
  $terms = [ordered]@{}
  foreach ($t in [regex]::Matches($m.Groups[1].Value, '\{"slug":"([a-z0-9\-]+)","name":"([^"]+)"\}')) {
    $terms[$t.Groups[1].Value] = [System.Net.WebUtility]::HtmlDecode($t.Groups[2].Value)
  }
  $vocab[$facet] = $terms
  Write-Host "  $facet : $($terms.Count) terms"
}

# slug -> facet -> list of term names
$bySlug = @{}
$counts = [ordered]@{}
$failedPages = @()
$requests = 0

foreach ($facet in $Facets) {
  if (-not $vocab.Contains($facet)) { continue }
  $param = $facetSpec[$facet].param
  $counts[$facet] = [ordered]@{}
  Write-Host ''
  Write-Host "=== $facet ==="

  foreach ($slugTerm in $vocab[$facet].Keys) {
    $label = $vocab[$facet][$slugTerm]

    try { $first = Get-Listing "$param=$slugTerm&page=1"; $requests++ }
    catch { Write-Host "  FAILED $slugTerm page 1: $($_.Exception.Message)"; $failedPages += "$facet/$slugTerm/1"; continue }

    $meta = Get-Total $first
    if (-not $meta) { Write-Host "  $slugTerm : no total marker, skipping"; continue }
    $pages = [math]::Ceiling($meta.total / $meta.size)
    $counts[$facet][$label] = $meta.total
    Write-Host ("  {0,-30} {1,5} items, {2,3} pages" -f $slugTerm, $meta.total, $pages)

    for ($page = 1; $page -le $pages; $page++) {
      $html = if ($page -eq 1) { $first } else {
        try { Start-Sleep -Milliseconds $DelayMs; $requests++; Get-Listing "$param=$slugTerm&page=$page" }
        catch { Write-Host "    FAILED page $page`: $($_.Exception.Message)"; $failedPages += "$facet/$slugTerm/$page"; $null }
      }
      if (-not $html) { continue }

      foreach ($slug in (Get-Cards $html)) {
        if (-not $bySlug.ContainsKey($slug)) {
          $bySlug[$slug] = [ordered]@{ types = @(); categories = @(); industries = @() }
        }
        if ($bySlug[$slug][$facet] -notcontains $label) { $bySlug[$slug][$facet] += $label }
      }
    }
  }
}

$items = foreach ($slug in ($bySlug.Keys | Sort-Object)) {
  $row = $bySlug[$slug]
  [PSCustomObject]@{
    slug = $slug
    # First of each list is the primary. Order follows the site's own taxonomy order.
    type       = if ($row.types.Count) { $row.types[0] } else { $null }
    types      = @($row.types)
    categories = @($row.categories)
    industries = @($row.industries)
  }
}
$items = @($items)

$payload = [ordered]@{
  source      = 'https://www.nice.com/resources, per-facet listing filters, English'
  fetched     = (Get-Date).ToString('yyyy-MM-dd')
  count       = $items.Count
  requests    = $requests
  facets      = ($vocab.Keys | ForEach-Object { [ordered]@{ facet = $_; terms = @($vocab[$_].Values) } })
  countByTerm = $counts
  note        = 'Authoritative: these are the content types, solution categories and industries the site itself assigns and filters on, not inferred from page text. A resource can carry several terms per facet. An empty list means the site assigns none, and a slug absent from this file is absent from the listing entirely, which is not the same as having no industry.'
  failedPages = @($failedPages)
  items       = $items
}

[System.IO.File]::WriteAllText($outFile, ($payload | ConvertTo-Json -Depth 6) + "`n")

Write-Host ''
Write-Host "Wrote $($items.Count) resources to catalog/nice-resource-facets.json in $requests requests"
if ($failedPages.Count) { Write-Host "Failed pages: $($failedPages -join ', ')" }
Write-Host ''
foreach ($facet in $counts.Keys) {
  $withAny = @($items | Where-Object { $_.$facet.Count -gt 0 }).Count
  Write-Host ("{0,-12} {1,5} of {2} resources tagged" -f $facet, $withAny, $items.Count)
}
