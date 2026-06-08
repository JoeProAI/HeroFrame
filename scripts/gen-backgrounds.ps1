$ErrorActionPreference = "Stop"
$key = $env:KIE_API_KEY
if (-not $key) { throw "Set KIE_API_KEY env var first." }
$headers = @{ Authorization = "Bearer $key"; "Content-Type" = "application/json" }
$base = "https://api.kie.ai"
$outDir = Join-Path $PSScriptRoot "..\public\bg"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$prompts = @(
  @{ name = "bg-superhero"; prompt = "Classic American superhero comic panel, halftone dots, bold ink outlines, dynamic caped hero mid-action, vibrant primary colors, isolated on dark background" },
  @{ name = "bg-manga"; prompt = "Japanese manga action page, dramatic speed lines, screentone shading, fierce hero pose, black and white with one accent, isolated on dark background" },
  @{ name = "bg-rubberhose"; prompt = "1930s rubber-hose cartoon character dancing, vintage cream and ink, playful, isolated on dark background" },
  @{ name = "bg-chibi"; prompt = "Cute chibi cartoon hero, big eyes, bold outlines, saturated pastel, sticker style, isolated on dark background" },
  @{ name = "bg-noir"; prompt = "Neo-noir cartoon city skyline with a caped silhouette on a rooftop, moody teal and amber, bold shapes, isolated on dark background" }
)

$tasks = @()
foreach ($p in $prompts) {
  $body = @{ model = "gpt-image-2-text-to-image"; input = @{ prompt = $p.prompt } } | ConvertTo-Json -Depth 6
  $resp = Invoke-RestMethod -Method Post -Uri "$base/api/v1/jobs/createTask" -Headers $headers -Body $body
  $taskId = $resp.data.taskId
  Write-Output "created $($p.name) -> $taskId"
  $tasks += @{ name = $p.name; taskId = $taskId }
}

foreach ($t in $tasks) {
  $done = $false
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 5
    $info = Invoke-RestMethod -Method Get -Uri "$base/api/v1/jobs/recordInfo?taskId=$($t.taskId)" -Headers $headers
    $state = $info.data.state
    if ($state -eq "success") {
      $resultUrls = ($info.data.resultJson | ConvertFrom-Json).resultUrls
      $url = $resultUrls[0]
      $dest = Join-Path $outDir "$($t.name).png"
      Invoke-WebRequest -Uri $url -OutFile $dest
      Write-Output "saved $($t.name).png"
      $done = $true
      break
    }
    if ($state -eq "fail") { Write-Output "FAILED $($t.name): $($info.data.failMsg)"; $done = $true; break }
  }
  if (-not $done) { Write-Output "TIMEOUT $($t.name)" }
}
Write-Output "ALL DONE"
