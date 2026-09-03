# Builds an index of everything under https://www.nice.com/resources into
# catalog/nice-resources-index.json
#
#   pwsh tools/fetch-nice-resources.ps1
#
# Source is the public sitemap (linked from robots.txt), not the listing page. The listing is a
# Next.js App Router view that fetches client-side: its HTML carries only the first 14 cards, no
# pagination links, no buildId and no inline records, so there is nothing there to page through.
# The sitemap is the authoritative and complete list, and it is one request instead of hundreds.
#
# WHAT IS REAL AND WHAT IS DERIVED
#   real     url, lastmod
#   derived  title  (de-slugged, so capitalisation and punctuation are approximations)
#   derived  category (keyword match on the slug, deliberately coarse)
#
# The sitemap carries no titles or content types. Getting the real ones means fetching each of
# ~2,100 pages, which is slow and unkind to their servers. Do that only for a shortlist you
# actually intend to use.

$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$outFile = Join-Path $repoRoot 'catalog\nice-resources-index.json'
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

# Acronyms that must not be title-cased into nonsense.
$acronyms = @{
  'ai'='AI'; 'cx'='CX'; 'ccaas'='CCaaS'; 'roi'='ROI'; 'wfm'='WFM'; 'wem'='WEM'; 'ivr'='IVR';
  'crm'='CRM'; 'sla'='SLA'; 'api'='API'; 'apis'='APIs'; 'nice'='NiCE'; 'isg'='ISG'; 'idc'='IDC';
  'kpi'='KPI'; 'kpis'='KPIs'; 'qm'='QM'; 'bpo'='BPO'; 'saas'='SaaS'; 'llm'='LLM'; 'apac'='APAC';
  'emea'='EMEA'; 'us'='US'; 'uk'='UK'; 'genai'='GenAI'; 'faq'='FAQ'; 'sms'='SMS'; 'acd'='ACD'
}

function Get-TitleFromSlug([string]$slug) {
  $words = $slug -split '-' | Where-Object { $_ -ne '' }
  $out = foreach ($w in $words) {
    if ($acronyms.ContainsKey($w)) { $acronyms[$w] }
    else { $w.Substring(0,1).ToUpper() + $w.Substring(1) }
  }
  ($out -join ' ')
}

# Coarse on purpose. Order matters: the first match wins.
$rules = @(
  @{ name = 'Analyst report'; pattern = 'peak-matrix|magic-quadrant|forrester|gartner|\bidc\b|\bisg\b|everest|analyst|buyers-guide|the-wave|quadrant' },
  @{ name = 'Customer story'; pattern = 'case-study|customer-story|success-story|-powers-|-cuts-|-boosts-|-refreshes-|-transforms-|testimonial' },
  @{ name = 'Webinar';        pattern = 'webinar|on-demand|roundtable|fireside' },
  @{ name = 'Video';          pattern = 'video|demo|product-tour|walkthrough|series' },
  @{ name = 'Guide or ebook'; pattern = 'ebook|e-book|guide|playbook|handbook|checklist|toolkit|blueprint|how-to' },
  @{ name = 'Report or research'; pattern = 'report|research|survey|benchmark|study|index|trends|outlook|state-of' },
  @{ name = 'Datasheet or brochure'; pattern = 'datasheet|data-sheet|brochure|spec-sheet|one-pager|fact-sheet|overview' },
  @{ name = 'Infographic';    pattern = 'infographic' },
  @{ name = 'Event';          pattern = 'interactions|nice-world|summit|conference|event' }
)

function Get-Category([string]$slug) {
  foreach ($rule in $rules) {
    if ($slug -match $rule.pattern) { return $rule.name }
  }
  return 'Uncategorised'
}

Write-Host 'Reading sitemap index...'
[xml]$index = (Invoke-WebRequest 'https://www.nice.com/sitemap.xml' -UseBasicParsing -TimeoutSec 45 -UserAgent $ua).Content
$maps = $index.sitemapindex.sitemap | ForEach-Object { [string]$_.loc } | Where-Object { $_ -match 'resources-sitemap' }

$items = @()
foreach ($map in $maps) {
  Write-Host "  $map"
  [xml]$x = (Invoke-WebRequest $map -UseBasicParsing -TimeoutSec 60 -UserAgent $ua).Content
  foreach ($u in $x.urlset.url) {
    $loc = [string]$u.loc
    if ($loc -notmatch '/resources/') { continue }

    # About a third of the sitemap is localised: /fr/resources/..., /de/resources/... and so on.
    # An earlier version matched only the English prefix and silently dropped 736 entries, which
    # looked like a clean 1411 rather than an incomplete 2147.
    $path = ([uri]$loc).AbsolutePath.Trim('/')
    $segments = $path -split '/'
    $locale = if ($segments[0] -ne 'resources') { $segments[0] } else { 'en' }
    $slug = $segments[-1]
    if ($slug -eq '' -or $slug -eq 'resources') { continue }

    $items += [PSCustomObject]@{
      slug     = $slug
      title    = Get-TitleFromSlug $slug
      category = Get-Category $slug
      locale   = $locale
      url      = $loc
      lastmod  = ([string]$u.lastmod)
    }
  }
}

$items = $items | Sort-Object lastmod -Descending

$payload = [ordered]@{
  source      = 'https://www.nice.com/resources via the public sitemap'
  fetched     = (Get-Date).ToString('yyyy-MM-dd')
  count       = $items.Count
  countByLocale = ($items | Group-Object locale | Sort-Object Count -Descending | ForEach-Object { [ordered]@{ locale = $_.Name; count = $_.Count } })
  countByCategory = ($items | Group-Object category | Sort-Object Count -Descending | ForEach-Object { [ordered]@{ category = $_.Name; count = $_.Count } })
  disclaimer  = 'url, locale and lastmod are real. title is de-slugged and category is a coarse keyword match on the slug, both approximations. The sitemap carries no titles or content types; getting the real ones means fetching each page, which is worth doing only for a shortlist you intend to use.'
  items       = $items
}

[System.IO.File]::WriteAllText($outFile, ($payload | ConvertTo-Json -Depth 5) + "`n")

Write-Host ''
Write-Host "Wrote $($items.Count) resources to catalog/nice-resources-index.json"
Write-Host ''
Write-Host 'By locale:'
$items | Group-Object locale | Sort-Object Count -Descending | ForEach-Object { '{0,6}  {1}' -f $_.Count, $_.Name }
Write-Host ''
Write-Host 'By category (English only, approximate):'
$items | Where-Object { $_.locale -eq 'en' } | Group-Object category | Sort-Object Count -Descending | ForEach-Object { '{0,6}  {1}' -f $_.Count, $_.Name }
