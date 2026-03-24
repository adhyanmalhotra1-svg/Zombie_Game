#Requires -Version 5.1
<#
.SYNOPSIS
  Build and deploy the static Zombie Shooter app to Google Cloud Run (Mumbai).

  Prerequisites:
  - Google Cloud SDK installed: https://cloud.google.com/sdk/docs/install
  - Authenticated once:  gcloud auth login
  - Billing enabled on project adhyan-zombie-game

  Project ID:     adhyan-zombie-game
  Project number: 345531793392
  Region:         asia-south1 (Mumbai)
#>

$ErrorActionPreference = "Stop"

$ProjectId = "adhyan-zombie-game"
$Region    = "asia-south1"
$Service   = "zombie-shooter"

Write-Host "Setting project to $ProjectId ..."
gcloud config set project $ProjectId

Write-Host "Enabling required APIs (Run, Cloud Build, Artifact Registry) ..."
gcloud services enable `
  run.googleapis.com `
  cloudbuild.googleapis.com `
  artifactregistry.googleapis.com `
  --project $ProjectId

Write-Host "Deploying to Cloud Run ($Region) — this uploads source and builds in Cloud Build ..."
gcloud run deploy $Service `
  --source "$PSScriptRoot" `
  --region $Region `
  --platform managed `
  --allow-unauthenticated `
  --project $ProjectId `
  --quiet

Write-Host ""
Write-Host "Done. Fetching service URL ..."
gcloud run services describe $Service --region $Region --project $ProjectId --format "value(status.url)"
