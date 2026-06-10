$ErrorActionPreference = "Stop"
$key = $env:KIE_API_KEY
if (-not $key) { throw "Set KIE_API_KEY env var first." }
$headers = @{ Authorization = "Bearer $key"; "Content-Type" = "application/json" }
$api = "https://api.kie.ai"
$uploadUrl = "https://kieai.redpandaai.co/api/file-base64-upload"
$dir = Join-Path $PSScriptRoot "..\public\bg"
$names = @("bg-hero", "bg-manga", "bg-chibi", "bg-mecha", "bg-noir")

$site = "https://cartoon-hero-orchestrator.vercel.app"
foreach ($name in $names) {
  # images are public on the deployed site; feed those URLs to remove-bg
  $imageUrl = "$site/bg/$name.png"

  # remove background
  $rbBody = @{ model = "recraft/remove-background"; input = @{ image = $imageUrl } } | ConvertTo-Json -Depth 4
  $task = Invoke-RestMethod -Method Post -Uri "$api/api/v1/jobs/createTask" -Headers $headers -Body $rbBody
  $taskId = $task.data.taskId
  Write-Output "removing bg $name -> $taskId"

  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 4
    $info = Invoke-RestMethod -Method Get -Uri "$api/api/v1/jobs/recordInfo?taskId=$taskId" -Headers $headers
    if ($info.data.state -eq "success") {
      $out = ($info.data.resultJson | ConvertFrom-Json).resultUrls[0]
      Invoke-WebRequest -Uri $out -OutFile (Join-Path $dir "$name.png")
      Write-Output "saved transparent $name.png"; break
    }
    if ($info.data.state -eq "fail") { Write-Output ("FAILED {0}: {1}" -f $name, $info.data.failMsg); break }
    if ($i -eq 59) { Write-Output "TIMEOUT $name" }
  }
}
Write-Output "DONE"
