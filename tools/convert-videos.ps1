param(
  [string]$VideoDir = (Join-Path $PSScriptRoot "..\\video"),
  [ValidateSet("all", "lesson-landscape", "promo-vertical")]
  [string]$Profile = "all",
  [int]$LessonHeight = 1080,
  [int]$PromoWidth = 1080,
  [int]$PromoHeight = 1920,
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

function Get-VideoProfileArgs([string]$VideoProfile) {
  switch ($VideoProfile) {
    "lesson-landscape" {
      return @(
        "-vf", "scale=-2:$LessonHeight,fps=30",
        "-pix_fmt", "yuv420p",
        "-profile:v", "high",
        "-level", "4.1",
        "-c:v", "libx264",
        "-preset", $Preset,
        "-crf", "$Crf",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart"
      )
    }
    "promo-vertical" {
      return @(
        "-vf", "scale=$PromoWidth`:$PromoHeight`:force_original_aspect_ratio=decrease,pad=$PromoWidth`:$PromoHeight`:(ow-iw)/2`:(oh-ih)/2`:black,fps=30",
        "-pix_fmt", "yuv420p",
        "-profile:v", "high",
        "-level", "4.1",
        "-c:v", "libx264",
        "-preset", $Preset,
        "-crf", "$Crf",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart"
      )
    }
    default {
      throw "Profil video necunoscut: $VideoProfile"
    }
  }
}

function Convert-VideoFile(
  [string]$InputPath,
  [string]$OutputPath,
  [string]$VideoProfile
) {
  if (-not (Test-Path $InputPath)) {
    Write-Host "Skip: nu exista $InputPath" -ForegroundColor Yellow
    return
  }

  $inputSizeMb = Get-VideoSizeMb $InputPath
  Write-Host "Convert ($VideoProfile) $InputPath -> $OutputPath ($inputSizeMb MB)" -ForegroundColor Cyan

  $arguments = @(
    "-y",
    "-i", $InputPath
  )

  $arguments += Get-VideoProfileArgs -VideoProfile $VideoProfile
  $arguments += $OutputPath

  & $script:FfmpegCommand @arguments

  $outputSizeMb = Get-VideoSizeMb $OutputPath
  Write-Host "Done: $OutputPath ($outputSizeMb MB)" -ForegroundColor Green
}

$script:FfmpegCommand = Require-Command -CommandName "ffmpeg" -InstallHint "Instaleaza FFmpeg si apoi ruleaza din nou scriptul. Varianta rapida pe Windows: winget install Gyan.FFmpeg"

$resolvedVideoDir = Resolve-Path $VideoDir
$videoDirPath = $resolvedVideoDir.Path

$lesson1Source = Find-FirstExistingPath @(
  (Join-Path $videoDirPath "Lectia 1.mov"),
  (Join-Path $videoDirPath "lesson-1.mp4")
)
$lesson2Source = Find-FirstExistingPath @(
  (Join-Path $videoDirPath "Lectia 2.mp4"),
  (Join-Path $videoDirPath "Lectia 2.mov"),
  (Join-Path $videoDirPath "lesson-2.mp4")
)
$lesson3Source = Find-FirstExistingPath @(
  (Join-Path $videoDirPath "Lectia 3.mov"),
  (Join-Path $videoDirPath "lesson-3.mp4")
)
$methodSource = Find-FirstExistingPath @(
  (Join-Path $videoDirPath "method-v2-vertical.mp4"),
  (Join-Path $videoDirPath "Video_metda_depredare!.mp4"),
  (Join-Path $videoDirPath "method.mp4")
)
$academySource = Find-FirstExistingPath @(
  (Join-Path $videoDirPath "academy-v2-vertical.mp4"),
  (Join-Path $videoDirPath "Despre academie.mp4"),
  (Join-Path $videoDirPath "Despre_academie.mp4"),
  (Join-Path $videoDirPath "Despre academie.mov"),
  (Join-Path $videoDirPath "academy.mp4")
)
$webinarSource = Find-FirstExistingPath @(
  (Join-Path $videoDirPath "webinar-fear-v2-vertical.mp4"),
  (Join-Path $videoDirPath "Webinar_fear_speaking.mp4"),
  (Join-Path $videoDirPath "Webinar_fear_speaking.mov"),
  (Join-Path $videoDirPath "Webinar fear speaking.mp4"),
  (Join-Path $videoDirPath "webinar-fear.mp4")
)

$lesson1Target = Join-Path $videoDirPath "lesson-1-v2-landscape.mp4"
$lesson2Target = Join-Path $videoDirPath "lesson-2-v2-landscape.mp4"
$lesson3Target = Join-Path $videoDirPath "lesson-3-v2-landscape.mp4"
$methodTarget = Join-Path $videoDirPath "method-v2-vertical.mp4"
$academyTarget = Join-Path $videoDirPath "academy-v2-vertical.mp4"
$webinarTarget = Join-Path $videoDirPath "webinar-fear-v2-vertical.mp4"

if ($Profile -in @("all", "lesson-landscape")) {
  Convert-VideoFile -InputPath $lesson1Source -OutputPath $lesson1Target -VideoProfile "lesson-landscape"
  Convert-VideoFile -InputPath $lesson2Source -OutputPath $lesson2Target -VideoProfile "lesson-landscape"
  Convert-VideoFile -InputPath $lesson3Source -OutputPath $lesson3Target -VideoProfile "lesson-landscape"
}

if ($Profile -in @("all", "promo-vertical")) {
  Convert-VideoFile -InputPath $methodSource -OutputPath $methodTarget -VideoProfile "promo-vertical"
  Convert-VideoFile -InputPath $academySource -OutputPath $academyTarget -VideoProfile "promo-vertical"
  Convert-VideoFile -InputPath $webinarSource -OutputPath $webinarTarget -VideoProfile "promo-vertical"
}

Write-Host ""
Write-Host "Profiluri disponibile:" -ForegroundColor Cyan
Write-Host "- lesson-landscape: pentru lectii 16:9 optimizate pentru Telegram"
Write-Host "- promo-vertical: pentru exporturi 9:16 pregatite pentru mobil"
Write-Host ""
Write-Host "Atentie: profilul promo-vertical presupune ca framing-ul a fost refacut corect din sursa originala in editor." -ForegroundColor Yellow
Write-Host "Daca sursa ramane landscape si doar o convertesti tehnic, nu vei obtine un rezultat bun pe telefon." -ForegroundColor Yellow
Write-Host ""
Write-Host "Botul cauta acum aceste nume versionate in folderul video:" -ForegroundColor Cyan
Write-Host "- lesson-1-v2-landscape.mp4"
Write-Host "- lesson-2-v2-landscape.mp4"
Write-Host "- lesson-3-v2-landscape.mp4"
Write-Host "- method-v2-vertical.mp4"
Write-Host "- academy-v2-vertical.mp4"
Write-Host "- webinar-fear-v2-vertical.mp4"
