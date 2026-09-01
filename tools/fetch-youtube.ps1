# Fetches the public video list for a YouTube channel into catalog/youtube-videos.json.
#
#   pwsh tools/fetch-youtube.ps1
#   pwsh tools/fetch-youtube.ps1 -ChannelId UC4tmsS3fAVLp1Ue0DF-EauA
#
# Uses the documented public Atom feed rather than scraping the channel HTML. The HTML shell
# varies between fetches (one request returned 1.1 MB with parseable data, the next 570 KB
# without), so scraping it is unreliable. The trade-off is that the feed returns only the most
# recent 15 videos.
#
# For the full channel history you need the YouTube Data API v3 and an API key:
#   GET https://www.googleapis.com/youtube/v3/playlistItems
#       ?playlistId=UU<channelId without UC>&part=snippet&maxResults=50&key=<KEY>
# Pass the key via the YOUTUBE_API_KEY environment variable, never on the command line and
# never committed. This script does not require one.
#
# Durations are read from each watch page's lengthSeconds field, since the feed omits them.

param(
  [string]$ChannelId = 'UC4tmsS3fAVLp1Ue0DF-EauA',
  [switch]$SkipDurations
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$repoRoot = Split-Path -Parent $PSScriptRoot
$outFile = Join-Path $repoRoot 'catalog\youtube-videos.json'

$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
# Declining non-essential cookies. YouTube otherwise serves a consent interstitial.
$session.Cookies.Add((New-Object System.Net.Cookie('CONSENT', 'YES+cb.20210328-17-p0.en+FX+000', '/', '.youtube.com')))

$feedUrl = "https://www.youtube.com/feeds/videos.xml?channel_id=$ChannelId"
Write-Host "Fetching $feedUrl"
$resp = Invoke-WebRequest -Uri $feedUrl -UseBasicParsing -TimeoutSec 45 -UserAgent $ua -WebSession $session
[xml]$feed = $resp.Content

$videos = @()
foreach ($entry in $feed.feed.entry) {
  $id = $entry.videoId
  if (-not $id) { continue }

  $description = ''
  if ($entry.group -and $entry.group.description) { $description = [string]$entry.group.description }

  $lengthSeconds = $null
  if (-not $SkipDurations) {
    try {
      $watch = Invoke-WebRequest -Uri "https://www.youtube.com/watch?v=$id" -UseBasicParsing -TimeoutSec 45 -UserAgent $ua -WebSession $session
      $m = [regex]::Match($watch.Content, '"lengthSeconds":"(\d+)"')
      if ($m.Success) { $lengthSeconds = [int]$m.Groups[1].Value }
    } catch {
      Write-Warning "Could not read duration for $id"
    }
  }

  $videos += [ordered]@{
    videoId       = $id
    title         = [string]$entry.title
    published     = [string]$entry.published
    lengthSeconds = $lengthSeconds
    description   = ($description -replace "`r`n", "`n")
    watchUrl      = "https://www.youtube.com/watch?v=$id"
    embedUrl      = "https://www.youtube-nocookie.com/embed/$id"
    thumbnailUrl  = "https://i.ytimg.com/vi/$id/hqdefault.jpg"
  }
  Write-Host ("  {0}  {1}s  {2}" -f $id, $lengthSeconds, $entry.title)
}

$payload = [ordered]@{
  channelId  = $ChannelId
  channel    = [string]$feed.feed.title
  fetchedVia = 'public Atom feed, most recent 15 videos only'
  videos     = $videos
}

[System.IO.File]::WriteAllText($outFile, ($payload | ConvertTo-Json -Depth 6) + "`n")
Write-Host ""
Write-Host "Wrote $($videos.Count) videos to catalog/youtube-videos.json"
