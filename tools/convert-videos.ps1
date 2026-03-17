param(
  [string]$VideoDir = (Join-Path $PSScriptRoot "..\\video"),
  [int]$Height = 1080,
  [int]$Crf = 23,
  [string]$Preset = "slow"
)

$ErrorActionPreference = "Stop"
$script:FfmpegCommand = $null

function Get-VideoSizeMb([string]$Path) {
  if (-not (Test-Path $Path)) {
    return $null
  }

  $item = Get-Item $Path
  return [math]::Round($item.Length / 1MB, 2)
}

function Resolve-CommandPath([string]$CommandName) {
  $command = Get-Command $CommandName -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $wingetLinks = Join-Path $env:LOCALAPPDATA "Microsoft\\WinGet\\Links\\$CommandName.exe"
  if (Test-Path $wingetLinks) {
    return $wingetLinks
  }

  $wingetPackage = Get-ChildItem (Join-Path $env:LOCALAPPDATA "Microsoft\\WinGet\\Packages") -Recurse -Filter "$CommandName.exe" -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($wingetPackage) {
    return $wingetPackage.FullName
  }

  return $null
}

function Require-Command([string]$CommandName, [string]$InstallHint) {
  $resolved = Resolve-CommandPath $CommandName
  if (-not $resolved) {
    throw "Comanda '$CommandName' nu exista in PATH. $InstallHint"
  }

  return $resolved
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
      "-pix_fmt", "yuv420p",
      "-profile:v", "high",
      "-level", "4.1",
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
      "-pix_fmt", "yuv420p",
      "-profile:v", "high",
      "-level", "4.1",
      "-c:v", "libx264",
      "-preset", $Preset,
      "-crf", "$Crf",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      $OutputPath
    )
  }

  & $script:FfmpegCommand @arguments

  $outputSizeMb = Get-VideoSizeMb $OutputPath
  Write-Host "Done: $OutputPath ($outputSizeMb MB)" -ForegroundColor Green
}

function Find-FirstExistingPath([string[]]$Candidates) {
  foreach ($candidate in $Candidates) {
    if ([string]::IsNullOrWhiteSpace($candidate)) {
      continue
    }

    if (Test-Path $candidate) {
      return $candidate
    }
  }

  return $null
}

$script:FfmpegCommand = Require-Command -CommandName "ffmpeg" -InstallHint "Instaleaza FFmpeg si apoi ruleaza din nou scriptul. Varianta rapida pe Windows: winget install Gyan.FFmpeg"

$resolvedVideoDir = Resolve-Path $VideoDir
$videoDirPath = $resolvedVideoDir.Path

$lesson1Source = Join-Path $videoDirPath "Lectia 1.mov"
$lesson2SourceMp4 = Join-Path $videoDirPath "Lectia 2.mp4"
$lesson2SourceMov = Join-Path $videoDirPath "Lectia 2.mov"
$lesson3Source = Join-Path $videoDirPath "Lectia 3.mov"
$methodSource = Join-Path $videoDirPath "Video_metda_depredare!.mp4"
$academySource = Find-FirstExistingPath @(
  (Join-Path $videoDirPath "Despre academie.mp4"),
  (Join-Path $videoDirPath "Despre_academie.mp4"),
  (Join-Path $videoDirPath "Despre academie.mov")
)
$webinarSource = Find-FirstExistingPath @(
  (Join-Path $videoDirPath "Webinar_fear_speaking.mp4"),
  (Join-Path $videoDirPath "Webinar_fear_speaking.mov"),
  (Join-Path $videoDirPath "Webinar fear speaking.mp4")
)

$lesson1Target = Join-Path $videoDirPath "lesson-1.mp4"
$lesson2Target = Join-Path $videoDirPath "lesson-2.mp4"
$lesson3Target = Join-Path $videoDirPath "lesson-3.mp4"
$methodTarget = Join-Path $videoDirPath "method.mp4"
$academyTarget = Join-Path $videoDirPath "academy.mp4"
$webinarTarget = Join-Path $videoDirPath "webinar-fear.mp4"

Convert-VideoFile -InputPath $lesson1Source -OutputPath $lesson1Target

if (Test-Path $lesson2SourceMp4) {
  Convert-VideoFile -InputPath $lesson2SourceMp4 -OutputPath $lesson2Target -NormalizeOnly
} else {
  Convert-VideoFile -InputPath $lesson2SourceMov -OutputPath $lesson2Target
}

Convert-VideoFile -InputPath $lesson3Source -OutputPath $lesson3Target
Convert-VideoFile -InputPath $methodSource -OutputPath $methodTarget -NormalizeOnly
Convert-VideoFile -InputPath $academySource -OutputPath $academyTarget -NormalizeOnly
Convert-VideoFile -InputPath $webinarSource -OutputPath $webinarTarget -NormalizeOnly

Write-Host ""
Write-Host "Daca lesson-1.mp4 sau lesson-3.mp4 ies prea mari, urmeaza ordinea asta:" -ForegroundColor Yellow
Write-Host "1. rulezi din nou cu -Crf 24 sau -Crf 25" -ForegroundColor Yellow
Write-Host "2. doar daca e nevoie, urci la -Crf 26" -ForegroundColor Yellow
Write-Host "3. daca tot raman prea grele operational, le imparti in 2 parti" -ForegroundColor Yellow
Write-Host ""
Write-Host "Botul cauta acum aceste nume finale in folderul video:" -ForegroundColor Cyan
Write-Host "- lesson-1.mp4"
Write-Host "- lesson-2.mp4"
Write-Host "- lesson-3.mp4"
Write-Host "- method.mp4"
Write-Host "- academy.mp4"
Write-Host "- webinar-fear.mp4"
