param(
  [string]$VideoDir = (Join-Path $PSScriptRoot "..\\video"),
  [int]$Height = 720,
  [int]$Crf = 27,
  [string]$Preset = "medium"
)

$ErrorActionPreference = "Stop"

function Get-VideoSizeMb([string]$Path) {
  if (-not (Test-Path $Path)) {
    return $null
  }

  $item = Get-Item $Path
  return [math]::Round($item.Length / 1MB, 2)
}

function Require-Command([string]$CommandName, [string]$InstallHint) {
  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "Comanda '$CommandName' nu exista in PATH. $InstallHint"
  }
}

function Convert-VideoFile(
  [string]$InputPath,
  [string]$OutputPath,
  [switch]$NormalizeOnly
) {
  if (-not (Test-Path $InputPath)) {
    Write-Host "Skip: nu exista $InputPath" -ForegroundColor Yellow
    return
  }

  $inputSizeMb = Get-VideoSizeMb $InputPath
  Write-Host "Convert $InputPath -> $OutputPath ($inputSizeMb MB)" -ForegroundColor Cyan

  $arguments = @(
    "-y",
    "-i", $InputPath
  )

  if ($NormalizeOnly) {
    $arguments += @(
      "-c:v", "libx264",
      "-preset", $Preset,
      "-crf", "$Crf",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      $OutputPath
    )
  } else {
    $arguments += @(
      "-vf", "scale=-2:$Height,fps=30",
      "-c:v", "libx264",
      "-preset", $Preset,
      "-crf", "$Crf",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      $OutputPath
    )
  }

  & ffmpeg @arguments

  $outputSizeMb = Get-VideoSizeMb $OutputPath
  Write-Host "Done: $OutputPath ($outputSizeMb MB)" -ForegroundColor Green
}

Require-Command -CommandName "ffmpeg" -InstallHint "Instaleaza FFmpeg si apoi ruleaza din nou scriptul. Varianta rapida pe Windows: winget install Gyan.FFmpeg"

$resolvedVideoDir = Resolve-Path $VideoDir
$videoDirPath = $resolvedVideoDir.Path

$lesson1Source = Join-Path $videoDirPath "Lectia 1.mov"
$lesson2SourceMp4 = Join-Path $videoDirPath "Lectia 2.mp4"
$lesson2SourceMov = Join-Path $videoDirPath "Lectia 2.mov"
$lesson3Source = Join-Path $videoDirPath "Lectia 3.mov"
$methodSource = Join-Path $videoDirPath "Video_metda_depredare!.mp4"

$lesson1Target = Join-Path $videoDirPath "lesson-1.mp4"
$lesson2Target = Join-Path $videoDirPath "lesson-2.mp4"
$lesson3Target = Join-Path $videoDirPath "lesson-3.mp4"
$methodTarget = Join-Path $videoDirPath "method.mp4"

Convert-VideoFile -InputPath $lesson1Source -OutputPath $lesson1Target

if (Test-Path $lesson2SourceMp4) {
  Convert-VideoFile -InputPath $lesson2SourceMp4 -OutputPath $lesson2Target -NormalizeOnly
} else {
  Convert-VideoFile -InputPath $lesson2SourceMov -OutputPath $lesson2Target
}

Convert-VideoFile -InputPath $lesson3Source -OutputPath $lesson3Target
Convert-VideoFile -InputPath $methodSource -OutputPath $methodTarget -NormalizeOnly

Write-Host ""
Write-Host "Daca lesson-1.mp4 sau lesson-3.mp4 ies peste 50 MB, ai 2 optiuni:" -ForegroundColor Yellow
Write-Host "1. rulezi din nou cu -Crf 29 sau -Crf 30" -ForegroundColor Yellow
Write-Host "2. imparti video-ul in 2 parti" -ForegroundColor Yellow
Write-Host ""
Write-Host "Botul cauta acum aceste nume finale in folderul video:" -ForegroundColor Cyan
Write-Host "- lesson-1.mp4"
Write-Host "- lesson-2.mp4"
Write-Host "- lesson-3.mp4"
Write-Host "- method.mp4"
