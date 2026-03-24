# Connect this folder to GitHub and (optionally) push. Run from the project folder.
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\setup-github.ps1
#   powershell -ExecutionPolicy Bypass -File .\setup-github.ps1 -Push
#
# Repo (empty on GitHub until you push): https://github.com/adhyanmalhotra1-svg/Zombie_Game

param([switch]$Push)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$RepoUrl = "https://github.com/adhyanmalhotra1-svg/Zombie_Game.git"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "Install Git for Windows first: https://git-scm.com/download/win" -ForegroundColor Red
  Write-Host "Then reopen PowerShell and run this script again."
  exit 1
}

if (-not (Test-Path .git)) {
  git init
  Write-Host "Initialized Git repository." -ForegroundColor Green
}

git add -A
$status = git status --porcelain
if ($status) {
  git commit -m "Zombie Shooter web game"
  Write-Host "Committed local files." -ForegroundColor Green
} else {
  Write-Host "No changes to commit." -ForegroundColor Yellow
}

git branch -M main 2>$null

$origin = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0 -or -not $origin) {
  git remote add origin $RepoUrl
  Write-Host "Added remote: origin -> $RepoUrl" -ForegroundColor Green
} elseif ($origin -ne $RepoUrl) {
  Write-Host "Remote origin is already set to: $origin" -ForegroundColor Yellow
  Write-Host "To match this repo, run: git remote set-url origin $RepoUrl"
} else {
  Write-Host "Remote origin already points to Zombie_Game." -ForegroundColor Green
}

Write-Host ""
Write-Host "Your online repo: https://github.com/adhyanmalhotra1-svg/Zombie_Game" -ForegroundColor Cyan
Write-Host ""

if ($Push) {
  Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
  git push -u origin main
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Done. Refresh the repo page in your browser." -ForegroundColor Green
  } else {
    Write-Host "Push failed. Sign in to GitHub:" -ForegroundColor Yellow
    Write-Host "  - Install GitHub Desktop and sign in, or"
    Write-Host "  - Use a Personal Access Token when Git asks for a password (HTTPS)."
    Write-Host "  https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token"
  }
} else {
  Write-Host "To upload your code to GitHub, run:" -ForegroundColor Cyan
  Write-Host "  git push -u origin main"
  Write-Host ""
  Write-Host "Or run this script with -Push:" -ForegroundColor Cyan
  Write-Host "  powershell -ExecutionPolicy Bypass -File .\setup-github.ps1 -Push"
  Write-Host ""
}
