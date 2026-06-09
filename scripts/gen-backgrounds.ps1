$ErrorActionPreference = "Stop"
$key = $env:KIE_API_KEY
if (-not $key) { throw "Set KIE_API_KEY env var first." }
$headers = @{ Authorization = "Bearer $key"; "Content-Type" = "application/json" }
$base = "https://api.kie.ai"
$outDir = Join-Path $PSScriptRoot "..\public\bg"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# Bright, light-background cartoons so they read on a dark UI.
$prompts = @(
  @{ name = "bg-hero"; prompt = "Vibrant cartoon superhero mid-leap, bold clean outlines, bright saturated colors, simple light cream background, sticker art" },
  @{ name = "bg-manga"; prompt = "Energetic anime action hero, bright colors, clean lineart, light background, dynamic pose, sticker art" },
  @{ name = "bg-chibi"; prompt = "Cute chibi cartoon hero, big eyes, bright pastel colors, clean outlines, light background, sticker art" },
  @{ name = "bg-mecha"; prompt = "Colorful cartoon mecha robot hero, bold outlines, bright metallic colors, light background, sticker art" },
  @{ name = "bg-noir"; prompt = "Stylish cartoon caped hero standing tall, bright bold colors, clean outlines, light background, sticker art" }
)

$tasks = @()
foreach ($p in $prompts) {
  $body = @{ model = "gpt-image-2-text-to-image"; input = @{ prompt = $p.prompt } } | ConvertTo-Json -Depth 6
  $resp = Invoke-RestMethod -Method Post -Uri "$base/api/v1/jobs/createTask" -Headers $headers -Body $body
  Write-Output "created $($p.name) -> $($resp.data.taskId)"
  $tasks += @{ name = $p.name; taskId = $resp.data.taskId }
}

foreach ($t in $tasks) {
  for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 5
    $info = Invoke-RestMethod -Method Get -Uri "$base/api/v1/jobs/recordInfo?taskId=$($t.taskId)" -Headers $headers
    if ($info.data.state -eq "success") {
      $url = ($info.data.resultJson | ConvertFrom-Json).resultUrls[0]
      Invoke-WebRequest -Uri $url -OutFile (Join-Path $outDir "$($t.name).png")
      Write-Output "saved $($t.name).png"; break
    }
    if ($info.data.state -eq "fail") { Write-Output "FAILED $($t.name): $($info.data.failMsg)"; break }
    if ($i -eq 89) { Write-Output "TIMEOUT $($t.name)" }
  }
}
Write-Output "DONE"
