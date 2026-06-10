$ErrorActionPreference = "Stop"
$key = $env:KIE_API_KEY
if (-not $key) { throw "Set KIE_API_KEY env var first." }
$headers = @{ Authorization = "Bearer $key"; "Content-Type" = "application/json" }
$api = "https://api.kie.ai"
$dir = Join-Path $PSScriptRoot "..\public\bg"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

# Consistent premium art direction across the whole cast.
$style = "single full-body character, modern premium cartoon illustration, bold clean black linework, dynamic heroic pose, cel shading with soft gradients, sophisticated vibrant palette with warm amber and deep indigo accents, plain solid white background, centered, high detail"

$cast = @(
  @{ name = "cast-leader"; subj = "a caped hero leader with a confident stance" },
  @{ name = "cast-blade";  subj = "a sleek agile female warrior holding a glowing blade" },
  @{ name = "cast-brute";  subj = "a massive armored brute ally with huge fists" },
  @{ name = "cast-mask";   subj = "a cunning masked trickster villain with a sly grin" },
  @{ name = "cast-mecha";  subj = "a sleek heroic mecha robot" },
  @{ name = "cast-spark";  subj = "a small energetic lightning-powered sidekick" },
  @{ name = "cast-mage";   subj = "a mystic robed mage casting a glowing spell" },
  @{ name = "cast-beast";  subj = "a fierce loyal cartoon beast companion" }
)

function Wait-Task($taskId) {
  for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 4
    $info = Invoke-RestMethod -Method Get -Uri "$api/api/v1/jobs/recordInfo?taskId=$taskId" -Headers $headers
    if ($info.data.state -eq "success") { return ($info.data.resultJson | ConvertFrom-Json).resultUrls[0] }
    if ($info.data.state -eq "fail") { return $null }
  }
  return $null
}

foreach ($c in $cast) {
  $prompt = "$($c.subj), $style"
  $genBody = @{ model = "gpt-image-2-text-to-image"; input = @{ prompt = $prompt } } | ConvertTo-Json -Depth 5
  $gen = Invoke-RestMethod -Method Post -Uri "$api/api/v1/jobs/createTask" -Headers $headers -Body $genBody
  $imgUrl = Wait-Task $gen.data.taskId
  if (-not $imgUrl) { Write-Output ("gen failed {0}" -f $c.name); continue }
  Write-Output ("generated {0}" -f $c.name)

  $rbBody = @{ model = "recraft/remove-background"; input = @{ image = $imgUrl } } | ConvertTo-Json -Depth 5
  $rb = Invoke-RestMethod -Method Post -Uri "$api/api/v1/jobs/createTask" -Headers $headers -Body $rbBody
  $cutUrl = Wait-Task $rb.data.taskId
  if (-not $cutUrl) { Write-Output ("cutout failed {0}" -f $c.name); continue }

  Invoke-WebRequest -Uri $cutUrl -OutFile (Join-Path $dir "$($c.name).webp")
  Write-Output ("saved {0}.webp" -f $c.name)
}
Write-Output "DONE"
