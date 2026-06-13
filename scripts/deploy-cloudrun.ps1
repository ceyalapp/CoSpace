# CollabBuy → Cloud Run deploy. Run from repo root.
#
# Prereqs (one-time, on your machine):
#   1. winget install Google.CloudSDK
#   2. gcloud auth login
#   3. gcloud config set project <YOUR_PROJECT_ID>
#   4. Billing enabled on the project
#
# Required env vars (set in this shell before running):
#   $env:PROJECT_ID           = "your-gcp-project-id"
#   $env:SERVICE_ROLE_KEY     = "<paste service_role key from Supabase Dashboard>"
#
# Optional overrides:
#   $env:REGION               = "asia-south1"   # default
#   $env:SERVICE_NAME         = "collabuy"      # default

$ErrorActionPreference = "Stop"

# ─── inputs ─────────────────────────────────────────────────────
if (-not $env:PROJECT_ID)       { throw "Set `$env:PROJECT_ID first" }
if (-not $env:SERVICE_ROLE_KEY) { throw "Set `$env:SERVICE_ROLE_KEY first" }

$PROJECT_ID   = $env:PROJECT_ID
$REGION       = if ($env:REGION)       { $env:REGION }       else { "asia-south1" }
$SERVICE_NAME = if ($env:SERVICE_NAME) { $env:SERVICE_NAME } else { "collabuy" }
$SECRET_NAME  = "supabase-service-role"

# Pull non-secret config from .env (URL + anon key + Priya email).
$envFile = ".\.env"
if (-not (Test-Path $envFile)) { throw ".env not found in repo root" }
$envMap = @{}
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.*)$') { $envMap[$matches[1]] = $matches[2].Trim('"').Trim("'") }
}
$SUPABASE_URL      = $envMap['SUPABASE_URL']
$SUPABASE_ANON_KEY = $envMap['SUPABASE_ANON_KEY']
$PRIYA_EMAIL       = $envMap['PRIYA_EMAIL']
if (-not $SUPABASE_URL -or -not $SUPABASE_ANON_KEY) { throw "Missing SUPABASE_URL / SUPABASE_ANON_KEY in .env" }

Write-Host "→ Project:  $PROJECT_ID"
Write-Host "→ Region:   $REGION"
Write-Host "→ Service:  $SERVICE_NAME"
Write-Host ""

# ─── 1. Set active project ──────────────────────────────────────
gcloud config set project $PROJECT_ID | Out-Null

# ─── 2. Enable required APIs ────────────────────────────────────
Write-Host "→ Enabling Cloud Run, Cloud Build, Artifact Registry, Secret Manager…"
gcloud services enable `
  run.googleapis.com `
  cloudbuild.googleapis.com `
  artifactregistry.googleapis.com `
  secretmanager.googleapis.com `
  --project $PROJECT_ID | Out-Null

# ─── 3. Create / update the service-role secret ─────────────────
# Use `secrets list --filter` (always exits 0) instead of `secrets describe`,
# so we don't trip $ErrorActionPreference=Stop on the not-found path in PS 5.1.
$existing = & gcloud secrets list --filter="name:$SECRET_NAME" --format="value(name)" --project $PROJECT_ID
if ($existing) {
  Write-Host "→ Secret $SECRET_NAME exists — adding new version"
  $env:SERVICE_ROLE_KEY | & gcloud secrets versions add $SECRET_NAME --data-file=- --project $PROJECT_ID | Out-Null
} else {
  Write-Host "→ Creating secret $SECRET_NAME"
  $env:SERVICE_ROLE_KEY | & gcloud secrets create $SECRET_NAME --data-file=- --replication-policy=automatic --project $PROJECT_ID | Out-Null
}

# ─── 4. Grant Cloud Run runtime SA access to the secret ─────────
$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format='value(projectNumber)'
$RUNTIME_SA     = "$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
Write-Host "→ Granting $RUNTIME_SA → roles/secretmanager.secretAccessor on $SECRET_NAME"
gcloud secrets add-iam-policy-binding $SECRET_NAME `
  --member="serviceAccount:$RUNTIME_SA" `
  --role="roles/secretmanager.secretAccessor" `
  --project $PROJECT_ID | Out-Null

# ─── 5. Deploy ──────────────────────────────────────────────────
# --quiet auto-confirms the Artifact Registry repo-creation prompt on first deploy.
Write-Host "→ Deploying to Cloud Run (this builds from the Dockerfile via Cloud Build)…"
gcloud run deploy $SERVICE_NAME `
  --source . `
  --region $REGION `
  --project $PROJECT_ID `
  --allow-unauthenticated `
  --port 8080 `
  --memory 512Mi `
  --cpu 1 `
  --min-instances 0 `
  --max-instances 5 `
  --quiet `
  --set-env-vars "SUPABASE_URL=$SUPABASE_URL,SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY,PRIYA_EMAIL=$PRIYA_EMAIL,NODE_ENV=production" `
  --set-secrets "SUPABASE_SERVICE_ROLE_KEY=${SECRET_NAME}:latest"

$URL = gcloud run services describe $SERVICE_NAME --region $REGION --project $PROJECT_ID --format='value(status.url)'
Write-Host ""
Write-Host "✓ Deployed: $URL"
Write-Host ""
Write-Host "Next steps (manual, in Supabase Dashboard):"
Write-Host "  • Auth → URL Configuration → Site URL:      $URL"
Write-Host "  • Auth → URL Configuration → Redirect URLs: add $URL/**"
Write-Host "    Without this, magic-link clicks will land on localhost and fail."
