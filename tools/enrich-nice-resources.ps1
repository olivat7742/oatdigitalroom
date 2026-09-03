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

# The authoritative facets, harvested from the listing's own filters by
# tools/fetch-nice-resource-facets.ps1: content type, solution category and industry. Where a
# slug appears here, this is what the site itself says, and the type overrides everything
# Resolve-Type can infer from the text.
# Optional: without the file the script still runs, it just infers more and knows less.
$typesFile = Join-Path $repoRoot 'catalog\nice-resource-facets.json'

# The facets file stores the site's own labels verbatim, which are plural collection names
# ("Case Studies"). Inferred types are singular ("Case study"). Merging the two unnormalised
# put both "Webinars" and "Webinar" in the same column, which would split any group-by. The
# facets file stays a faithful mirror of the site; normalising is this consumer's job.
$siteTypeLabels = @{
  'Brochure' = 'Brochure'; 'Case Studies' = 'Case study'; 'Datasheets' = 'Datasheet'
  'Demo Videos' = 'Demo video'; 'eBook' = 'eBook'; 'Infographics' = 'Infographic'
  'Podcasts' = 'Podcast'; 'Product Videos' = 'Product video'; 'Reports' = 'Report'
  'Testimonials' = 'Testimonial'; 'Webinars' = 'Webinar'; 'White Papers' = 'White paper'
}
function Normalize-TypeLabel([string]$label) {
  if (-not $label) { return $label }
  if ($siteTypeLabels.ContainsKey($label)) { return $siteTypeLabels[$label] }
  # A term added to the site that this map does not know. Pass it through rather than drop it,
  # but say so, because it means the map needs a line.
  Write-Host "  NOTE: unmapped site type label '$label', passing through as-is"
  $label
}
$authoritative = @{}
$authoritativeAll = @{}
$authoritativeCategories = @{}
$authoritativeIndustries = @{}
if (Test-Path $typesFile) {
  $t = [System.IO.File]::ReadAllText($typesFile) | ConvertFrom-Json
  foreach ($row in $t.items) {
    if ($row.type) { $authoritative[$row.slug] = Normalize-TypeLabel $row.type }
    $authoritativeAll[$row.slug] = @($row.types | ForEach-Object { Normalize-TypeLabel $_ })
    $authoritativeCategories[$row.slug] = @($row.categories)
    $authoritativeIndustries[$row.slug] = @($row.industries)
  }
  Write-Host "Authoritative facets available for $($t.items.Count) slugs ($($authoritative.Count) with a type)"

  # The listing is a second source of truth for what EXISTS, not just for facets. A few
  # resources are published in the listing but absent from the sitemap, so indexing from the
  # sitemap alone quietly misses them. Add any such slug to the fetch set.
  $known = @{}
  foreach ($row in $targets) { $known[$row.slug] = $true }
  $extra = @($t.items | Where-Object { -not $known.ContainsKey($_.slug) } | ForEach-Object {
    [PSCustomObject]@{
      slug = $_.slug; title = $_.slug; category = $_.type; locale = 'en'
      url = "https://www.nice.com/resources/$($_.slug)"; lastmod = ''
    }
  })
  if ($extra.Count) {
    Write-Host "  plus $($extra.Count) in the listing but missing from the sitemap"
    $targets = @($targets) + $extra
  }
}

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
  # Named analyst research programmes. Recognising "SPARK Matrix" as QKS Group research is not
  # a guess in the way that calling an untitled page a case study would be, so these are safe
  # to type even though the word "report" never appears.
  if ($probe -match 'peak matrix|magic quadrant|forrester|gartner|\bidc\b|\bisg\b|everest group|frost|omdia|ventana|nucleus|metrigy|quadrant|spark matrix|metristar|metrirank|qks group|the forrester wave') {
    return 'Analyst report'
  }

  if ($description) {
    $desc = $description.ToLower()
    foreach ($key in $descriptionRules.Keys) {
      if ($desc -match $descriptionRules[$key]) { return $key }
    }
  }

  # Honest default. Guessing here would put a wrong type on hundreds of records. The site's
  # own answer is harvested separately by tools/fetch-nice-resource-types.ps1 and applied by
  # Resolve-TypeFor below, which is why this fallback now fires far less often.
  return 'Unknown'
}

# The site's own answer where there is one, inference only where there is not.
function Resolve-TypeFor($item, [string]$breadcrumbTitle, [string]$fullTitle, [string]$description) {
  if ($script:authoritative.ContainsKey($item.slug)) { return $script:authoritative[$item.slug] }
  Resolve-Type $breadcrumbTitle $fullTitle $description
}

# Returns a JSON-safe list, and the shape here is load-bearing.
#
# ConvertTo-Json in PowerShell 5.1 writes a one-element array as a bare string and an empty
# array as {} or null, so "industries": ["Financial"] silently became "industries":
# "Financial". Every consumer that called .map or .includes on it then broke, and 1,314 of
# 1,414 records were affected before this was caught by a build crash.
#
# A generic List serialises correctly for zero, one and many. The leading comma stops
# PowerShell unrolling the list back into loose values on return, which would undo it.
function Get-Facet($map, [string]$slug) {
  $list = New-Object 'System.Collections.Generic.List[string]'
  if ($map.ContainsKey($slug)) {
    foreach ($value in @($map[$slug])) { if ($null -ne $value) { $list.Add([string]$value) } }
  }
  , $list
}

# Records already on disk predate these fields, so set-or-add rather than assuming either.
function Set-Field($item, [string]$name, $value) {
  if ($item.PSObject.Properties[$name]) { $item.$name = $value }
  else { $item | Add-Member -NotePropertyName $name -NotePropertyValue $value }
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
    countByTypeSource = ($items | Group-Object typeSource | Sort-Object Count -Descending | ForEach-Object { [ordered]@{ source = $_.Name; count = $_.Count } })
    countByIndustry = ($items | ForEach-Object { $_.industries } | Group-Object | Sort-Object Count -Descending | ForEach-Object { [ordered]@{ industry = $_.Name; count = $_.Count } })
    countByCategory = ($items | ForEach-Object { $_.categories } | Group-Object | Sort-Object Count -Descending | ForEach-Object { [ordered]@{ category = $_.Name; count = $_.Count } })
    note       = 'title and description are the real values from each page. type is the site''s own content type where typeSource is "site", taken from the listing taxonomy; where typeSource is "inferred" it is a keyword guess from the breadcrumb, title or description, because that slug is absent from the listing. types, categories and industries are the site''s own taxonomy terms and are never inferred: an empty list means the site assigns none, which is not the same as the resource having no industry.'
    items      = $items
  }
  $json = ($payload | ConvertTo-Json -Depth 5) + "`n"

  # Retried, because this write fails intermittently with "The requested operation cannot be
  # performed on a file with a user-mapped section open". The repo lives in a OneDrive folder
  # and the dev server watches it, so a sync or a watcher can hold the file mapped for a
  # moment. An intermediate flush failing is survivable, since everything stays in $done and
  # the next flush writes it all. The FINAL flush failing would throw away the whole crawl,
  # which for the full English set is 1,414 requests and about twenty minutes.
  for ($attempt = 1; $attempt -le 6; $attempt++) {
    try {
      [System.IO.File]::WriteAllText($script:outFile, $json)
      return
    } catch {
      if ($attempt -eq 6) {
        Write-Host "  SAVE FAILED after $attempt attempts: $($_.Exception.Message)"
        throw
      }
      Start-Sleep -Milliseconds (400 * $attempt)
    }
  }
}

# Placed below BOTH function definitions on purpose. PowerShell resolves functions in script
# order, so an earlier version of this block sat above them and every call failed with
# "not recognized as the name of a cmdlet".
if ($RetypeOnly) {
  foreach ($key in @($done.Keys)) {
    $item = $done[$key]
    # fullTitle is the og:title; title is the breadcrumb where one existed.
    $item.type = Resolve-TypeFor $item $item.title $item.fullTitle $item.description
    $src = if ($authoritative.ContainsKey($item.slug)) { 'site' } elseif ($item.type -eq 'Unknown') { 'none' } else { 'inferred' }
    Set-Field $item 'types'      (Get-Facet $authoritativeAll        $item.slug)
    Set-Field $item 'categories' (Get-Facet $authoritativeCategories $item.slug)
    Set-Field $item 'industries' (Get-Facet $authoritativeIndustries $item.slug)
    Set-Field $item 'typeSource' $src
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

    $ogDescription = Get-Meta $html 'og:description'
    $metaDescription = Get-Meta $html 'description'

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

    # Some pages carry another page's Open Graph block. The Optum case study declares
    # og:title "Vera Bradley Embraces Digital-First Omnichannel" and a matching og:description
    # about a luggage retailer, while its plain description meta is correctly about Optum. The
    # breadcrumb and the body both say Optum, so the og: block is simply wrong, presumably
    # copied when the page was created.
    #
    # This matters more than a tidy-up: the description is what the Digital Room shows a
    # visitor on the stage, and "Case Study: Optum" described as a handbag retailer is the kind
    # of error that ends a demo.
    #
    # Detection rule: if og:title contradicts the breadcrumb title, treat the whole og: block
    # as belonging to another page and prefer the plain description meta. Comparison is on the
    # leading words rather than equality, because og:title is the long marketing headline
    # while the breadcrumb is the short form, so they rarely match exactly even when correct.
    $description = $ogDescription
    $descriptionSource = 'og:description'
    if ($breadcrumbTitle -and $ogTitle -and $metaDescription) {
      $crumbKey = ($breadcrumbTitle -replace '^[^:]{3,30}:\s*', '') -replace '[^a-z0-9 ]', ''
      $crumbKey = ($crumbKey.ToLower() -split '\s+' | Where-Object { $_.Length -gt 3 } | Select-Object -First 3) -join ' '
      $ogKey = ($ogTitle.ToLower() -replace '[^a-z0-9 ]', '')
      if ($crumbKey -and -not $ogKey.Contains($crumbKey)) {
        # Also require the plain description to actually mention the breadcrumb subject, so a
        # merely-different phrasing of the headline does not silently swap in worse text.
        $subject = (($breadcrumbTitle -replace '^[^:]{3,30}:\s*', '').ToLower() -split '\s+' | Where-Object { $_.Length -gt 3 } | Select-Object -First 1)
        if ($subject -and $metaDescription.ToLower().Contains($subject)) {
          $description = $metaDescription
          $descriptionSource = 'description (og: block belongs to another page)'
        }
      }
    }
    if (-not $description) {
      $description = $metaDescription
      $descriptionSource = 'description'
    }

    $done[$target.slug] = [PSCustomObject]@{
      slug        = $target.slug
      title       = if ($breadcrumbTitle) { $breadcrumbTitle } else { $ogTitle }
      fullTitle   = $ogTitle
      type        = Resolve-TypeFor $target $breadcrumbTitle $ogTitle $description
      types       = Get-Facet $authoritativeAll $target.slug
      categories  = Get-Facet $authoritativeCategories $target.slug
      industries  = Get-Facet $authoritativeIndustries $target.slug
      typeSource  = if ($authoritative.ContainsKey($target.slug)) { 'site' } else { 'inferred' }
      description = $description
      # Recorded because the fallback is a judgement about which of two contradictory tags to
      # believe, and a reader of this data deserves to know when that judgement was exercised.
      descriptionSource = $descriptionSource
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
