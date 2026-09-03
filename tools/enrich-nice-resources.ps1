# Fetches the real title, description and content type for every ENGLISH resource in
# catalog/nice-resources-index.json, writing catalog/nice-resources-enriched.json
#
#   pwsh tools/enrich-nice-resources.ps1
#   pwsh tools/enrich-nice-resources.ps1 -Limit 50        # try a slice first
#   pwsh tools/enrich-nice-resources.ps1 -Force           # re-fetch everything
#
# RESUMABLE. Already-fetched slugs are skipped and progress is flushed every 25 pages, so a
# dropped connection or a closed terminal costs at most 25 requests. Re-running continues.
#
# WHY A PAGE FETCH AT ALL
# The sitemap has no titles and no content types, and the slugs are marketing titles with no
# type marker: "bose-dials-in-to-superior-customer-experience" is obviously a case study but
# nothing in the string says so. The page itself carries the answer.
#
# WHERE THE GOOD DATA IS
# The JSON-LD BreadcrumbList's last entry is the authoritative short title, and it frequently
# carries the type as a prefix, for example "Case Study: Bose". That beats og:title, which has
# " | NiCE" appended, and it beats counting type words in the page: the nav lists every type
# label on every page, so naive counting says each page is an ebook AND a video AND a webinar.
#
# COST AND COURTESY
# About 0.5s and 276KB per page, so roughly 380MB and 15-20 minutes for the full English set.
# Range requests are not honoured, so the whole body arrives whether or not it is wanted.
# A deliberate delay keeps this to a few requests a second rather than hammering their site.

param(
  [int]$Limit = 0,
  [switch]$Force,
  # Recompute types from data already on disk, without re-fetching anything. Use after
  # changing the typing rules.
  [switch]$RetypeOnly,
  [int]$DelayMs = 200
)

$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Continue'

$repoRoot = Split-Path -Parent $PSScriptRoot
$indexFile = Join-Path $repoRoot 'catalog\nice-resources-index.json'
$outFile = Join-Path $repoRoot 'catalog\nice-resources-enriched.json'
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

if (-not (Test-Path $indexFile)) {
  Write-Error "Missing $indexFile. Run tools/fetch-nice-resources.ps1 first."
  exit 1
}

$index = [System.IO.File]::ReadAllText($indexFile) | ConvertFrom-Json
$targets = @($index.items | Where-Object { $_.locale -eq 'en' })

# Resume from whatever is already on disk.
$done = @{}
if ((Test-Path $outFile) -and -not $Force) {
  try {
    $existing = [System.IO.File]::ReadAllText($outFile) | ConvertFrom-Json
    foreach ($item in $existing.items) { $done[$item.slug] = $item }
    Write-Host "Resuming: $($done.Count) already fetched"
  } catch {
    Write-Host 'Existing output unreadable, starting fresh'
  }
}

$pending = @($targets | Where-Object { -not $done.ContainsKey($_.slug) })
if ($Limit -gt 0 -and $pending.Count -gt $Limit) { $pending = $pending[0..($Limit - 1)] }

Write-Host "English resources: $($targets.Count).  To fetch now: $($pending.Count)."
Write-Host ''

# Type prefixes actually seen in breadcrumbs, mapped to a normalised label.
$typeMap = [ordered]@{
  'case study'      = 'Case study'
  'customer story'  = 'Case study'
  'success story'   = 'Case study'
  'white paper'     = 'White paper'
  'whitepaper'      = 'White paper'
  'ebook'           = 'eBook'
  'e-book'          = 'eBook'
  'guide'           = 'Guide'
  'buyer''s guide'  = 'Analyst report'
  'buyers guide'    = 'Analyst report'
  'analyst report'  = 'Analyst report'
  'report'          = 'Report'
  'research'        = 'Report'
  'datasheet'       = 'Datasheet'
  'data sheet'      = 'Datasheet'
  'brochure'        = 'Brochure'
  'webinar'         = 'Webinar'
  'video'           = 'Video'
  'video series'    = 'Video'
  'demo'            = 'Video'
  'infographic'     = 'Infographic'
  'blog'            = 'Blog'
  'article'         = 'Article'
  'podcast'         = 'Podcast'
  'checklist'       = 'Checklist'
  'toolkit'         = 'Toolkit'
}

# Longest first, so "buyers guide" wins over "guide". Ordered by insertion otherwise, which
# typed ISG and Everest buyer's guides as plain Guides rather than Analyst reports.
$typeKeysByLength = @($typeMap.Keys | Sort-Object { $_.Length } -Descending)

# Marketing copy usually names its own format: "In this eBook...", "Watch the video...".
# Weaker than a breadcrumb prefix, so only consulted once title-based typing has failed, and
# only where the text literally names the format rather than merely implying it.
$descriptionRules = [ordered]@{
  'Infographic' = '\binfographic\b'
  'Webinar'     = '\bwebinar\b|on-demand session'
  'eBook'       = '\bebook\b|\be-book\b'
  'White paper' = 'white paper|whitepaper'
  'Case study'  = '\bcase study\b|\bcustomer story\b|\bsuccess story\b'
  'Datasheet'   = '\bdatasheet\b|\bdata sheet\b|\bbrochure\b'
  'Guide'       = '\bguide\b|\bplaybook\b|\bhandbook\b|\bchecklist\b|\btoolkit\b'
  'Video'       = '\bvideo\b|\bwatch the\b|\bproduct tour\b'
  'Report'      = '\breport\b|\bsurvey\b|\bbenchmark\b|\bresearch\b'
}

function Resolve-Type([string]$breadcrumbTitle, [string]$fullTitle, [string]$description = '') {
  $probe = "$breadcrumbTitle $fullTitle".ToLower()

  # A breadcrumb prefix before a colon is the strongest signal: "Case Study: Bose".
  if ($breadcrumbTitle -match '^\s*([^:]{3,30}):') {
    $prefix = $Matches[1].Trim().ToLower()
    if ($typeMap.Contains($prefix)) { return $typeMap[$prefix] }
  }
  foreach ($key in $typeKeysByLength) {
    if ($probe -match ('\b' + [regex]::Escape($key) + '\b')) { return $typeMap[$key] }
  }
  # Analyst firms are a reliable tell even when the word "report" is absent.
  if ($probe -match 'peak matrix|magic quadrant|forrester|gartner|\bidc\b|\bisg\b|everest group|frost|omdia|ventana|nucleus|metrigy|quadrant') {
    return 'Analyst report'
  }

  if ($description) {
    $desc = $description.ToLower()
    foreach ($key in $descriptionRules.Keys) {
      if ($desc -match $descriptionRules[$key]) { return $key }
    }
  }

  # Honest default. The listing UI does know the type, but it is only reachable through a
  # client-side filter, and the individual pages carry no og:type, no taxonomy in embedded
  # JSON and no type badge. Guessing here would put a wrong type on hundreds of records.
  return 'Unknown'
}

function Get-Meta([string]$html, [string]$property) {
  $m = [regex]::Match($html, '<meta[^>]+(?:property|name)="' + [regex]::Escape($property) + '"[^>]+content="([^"]*)"')
  if ($m.Success) { return [System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value) }
  $m = [regex]::Match($html, '<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="' + [regex]::Escape($property) + '"')
  if ($m.Success) { return [System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value) }
  return ''
}

$fetched = 0
$failed = 0
$sinceFlush = 0

function Save-Progress {
  $items = @($done.Values | Sort-Object lastmod -Descending)
  $payload = [ordered]@{
    source     = 'https://www.nice.com/resources, English only, enriched from each page'
    fetched    = (Get-Date).ToString('yyyy-MM-dd')
    count      = $items.Count
    countByType = ($items | Group-Object type | Sort-Object Count -Descending | ForEach-Object { [ordered]@{ type = $_.Name; count = $_.Count } })
    note       = 'title and description are the real values from each page. type is taken from the JSON-LD breadcrumb prefix where present, then from title keywords, then from analyst firm names. Unknown means the page does not say.'
    items      = $items
  }
  [System.IO.File]::WriteAllText($script:outFile, ($payload | ConvertTo-Json -Depth 5) + "`n")
}

# Placed below BOTH function definitions on purpose. PowerShell resolves functions in script
# order, so an earlier version of this block sat above them and every call failed with
# "not recognized as the name of a cmdlet".
if ($RetypeOnly) {
  foreach ($key in @($done.Keys)) {
    $item = $done[$key]
    # fullTitle is the og:title; title is the breadcrumb where one existed.
    $item.type = Resolve-Type $item.title $item.fullTitle $item.description
  }
  Save-Progress
  Write-Host "Retyped $($done.Count) records without re-fetching."
  Write-Host ''
  @($done.Values) | Group-Object type | Sort-Object Count -Descending | ForEach-Object { '{0,6}  {1}' -f $_.Count, $_.Name }
  exit 0
}

foreach ($target in $pending) {
  try {
    $resp = Invoke-WebRequest -Uri $target.url -UseBasicParsing -TimeoutSec 40 -UserAgent $ua
    $html = $resp.Content

    $ogTitle = Get-Meta $html 'og:title'
    if (-not $ogTitle) {
      $m = [regex]::Match($html, '<title>([^<]+)</title>')
      if ($m.Success) { $ogTitle = [System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value) }
    }
    $ogTitle = ($ogTitle -replace '\s*\|\s*NiCE\s*$', '').Trim()

    $description = Get-Meta $html 'og:description'
    if (-not $description) { $description = Get-Meta $html 'description' }

    $breadcrumbTitle = ''
    $ld = [regex]::Match($html, '(?s)<script[^>]+application/ld\+json[^>]*>(.*?)</script>')
    if ($ld.Success) {
      try {
        $json = $ld.Groups[1].Value | ConvertFrom-Json
        $crumbs = $json.'@graph' | Where-Object { $_.'@type' -eq 'BreadcrumbList' }
        if ($crumbs) {
          $names = @($crumbs.itemListElement | ForEach-Object { $_.name })
          # Decoded: breadcrumbs arrive with HTML entities, so titles were showing &#8220; etc.
          if ($names.Count -gt 0) {
            $breadcrumbTitle = [System.Net.WebUtility]::HtmlDecode(([string]$names[-1])).Trim()
          }
        }
      } catch { }
    }

    $done[$target.slug] = [PSCustomObject]@{
      slug        = $target.slug
      title       = if ($breadcrumbTitle) { $breadcrumbTitle } else { $ogTitle }
      fullTitle   = $ogTitle
      type        = Resolve-Type $breadcrumbTitle $ogTitle $description
      description = $description
      url         = $target.url
      lastmod     = $target.lastmod
    }
    $fetched++
  } catch {
    $failed++
    Write-Host "  FAILED $($target.slug): $($_.Exception.Message)"
  }

  $sinceFlush++
  if ($sinceFlush -ge 25) { Save-Progress; $sinceFlush = 0; Write-Host "  ...$($done.Count) done" }
  Start-Sleep -Milliseconds $DelayMs
}

Save-Progress

Write-Host ''
Write-Host "Fetched $fetched, failed $failed, total on disk $($done.Count) of $($targets.Count)"
Write-Host ''
@($done.Values) | Group-Object type | Sort-Object Count -Descending | ForEach-Object { '{0,6}  {1}' -f $_.Count, $_.Name }
