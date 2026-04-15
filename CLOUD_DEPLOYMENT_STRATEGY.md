# TrustFrame — Cloud Deployment Strategy

> **Role**: Senior Cloud Architect  
> **Scope**: Full codebase analysis → platform recommendation → service list → cost report → step-by-step deployment guide  
> **Date**: April 2026

---

## Table of Contents

1. [Codebase and Architecture Review](#1-codebase-and-architecture-review)
2. [Deployment Smells and Pre-Migration Fixes](#2-deployment-smells-and-pre-migration-fixes)
3. [Cloud Platform Recommendation](#3-cloud-platform-recommendation)
4. [Required Cloud Services](#4-required-cloud-services)
5. [Monthly Cost Report](#5-monthly-cost-report)
6. [Step-by-Step Deployment Guide](#6-step-by-step-deployment-guide)

---

## 1. Codebase and Architecture Review

### 1.1 Technology Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Frontend | React + Vite | 18 / 5 | SPA, static build output |
| HTTP client | Axios | ^1.6.7 | 60s timeout, API proxy via Vite / nginx |
| Backend | FastAPI + uvicorn | 0.109.2 / 0.27.1 | Async, ASGI |
| ORM | SQLAlchemy | ≥2.0.36 | Dialect-aware (SQLite dev / PostgreSQL prod) |
| DB migrations | Alembic | 1.13.1 | Migration file present; not auto-run at startup |
| Dev database | SQLite | built-in | File-based, not suitable for production |
| Prod database | PostgreSQL | 16-alpine | Docker Compose service |
| File I/O | aiofiles | 23.2.1 | Async streaming; local filesystem only |
| File serving | FastAPI StaticFiles | — | Mounts `uploads/` at `/static/uploads/` |
| Rate limiting | slowapi | 0.1.9 | Initialized; **no decorators applied** |
| QR codes | qrcode[pil] + Pillow | 7.4.2 / ≥10.3 | PNG bytes generated on-demand |
| Hashing | hashlib (stdlib) | — | SHA-256 streaming |
| Tokens | secrets (stdlib) | — | 256-bit URL-safe tokens |
| Config | pydantic-settings | 2.2.1 | Reads from .env |
| Containerization | Docker + Docker Compose | v2 | 3 services: db, backend, frontend |
| Web server (prod) | nginx (alpine) | latest | Multi-stage build; SPA fallback; reverse proxy |

### 1.2 Architecture Classification

- **Pattern**: Monolith-in-containers — single FastAPI process handles all API routes
- **Frontend**: Static SPA (React build → served by nginx)
- **Backend**: Stateless ASGI process — scales horizontally if shared storage is added
- **Storage**: Local filesystem (`uploads/images/`, `uploads/videos/`) — not cloud-native
- **Database**: PostgreSQL 16 — standard managed DB candidate
- **Job queues**: None — all operations are synchronous request/response
- **Caching**: None — no Redis or in-memory cache layer
- **Background workers**: None
- **Real-time**: None — no WebSockets, SSE, or pub/sub
- **Health check**: `GET /health` → `{"status": "ok", "version": "1.0.0"}`
- **Ports**: Backend 8000, Frontend/nginx 80

### 1.3 Docker Analysis

```
docker-compose.yml
├── db           postgres:16-alpine  — port 5432, volume pgdata
│                healthcheck: pg_isready
├── backend      ./backend Dockerfile — port 8000, volume uploads, depends_on db (healthy)
│                restart: unless-stopped
└── frontend     ./frontend Dockerfile (multi-stage) — port 80, depends_on backend
                 restart: unless-stopped
```

Build arguments: `VITE_API_URL` passed at Docker build time — the frontend bakes the API URL into the static bundle.

---

## 2. Deployment Smells and Pre-Migration Fixes

These issues must be resolved **before** cloud deployment.

| # | Smell | Severity | Fix Required |
|---|---|---|---|
| S-01 | **Local file storage** — `uploads/` is a Docker named volume; not accessible across multiple backend instances | CRITICAL | Migrate to cloud object storage (S3 / GCS / Azure Blob). Swap `LocalStorage` service to use `boto3` or `google-cloud-storage`. |
| S-02 | **Hardcoded secrets in docker-compose.yml** — `SECRET_KEY`, `ADMIN_SECRET` default to weak strings | CRITICAL | Inject all secrets via cloud secrets manager (AWS Secrets Manager / GCP Secret Manager). Never bake into images. |
| S-03 | **Alembic migrations not auto-run** — `create_all()` at startup will silently ignore missing columns after schema changes | HIGH | Add an entrypoint script: run `alembic upgrade head` before `uvicorn` starts. |
| S-04 | **No rate limiting applied** — slowapi initialized but zero `@limiter.limit()` decorators | HIGH | Apply limits before exposing to the internet: `10/minute` on uploads, `60/minute` on session start. |
| S-05 | **VITE_API_URL baked into frontend build** — requires rebuild to change API URL | MEDIUM | Use a relative URL (`VITE_API_URL=`) and let nginx proxy handle the routing — already the pattern in docker-compose; confirm it holds in cloud. |
| S-06 | **No structured logging** — uvicorn default stdout only | MEDIUM | Add `structlog` or configure `logging` to output JSON — required for cloud log aggregation (CloudWatch, Cloud Logging, Log Analytics). |
| S-07 | **Admin secret is plain string comparison** — timing attack surface | MEDIUM | Use `hmac.compare_digest()`. |
| S-08 | **File MIME validation from Content-Type only** — no magic byte check | MEDIUM | Add `python-magic` validation before saving to object storage. |
| S-09 | **No database backup strategy** — Docker volume only | MEDIUM | Use managed database with automated backups enabled. |
| S-10 | **No CI/CD pipeline** | LOW-MEDIUM | Add GitHub Actions before first cloud deployment. |

---

## 3. Cloud Platform Recommendation

### 3.1 Recommendation: **Google Cloud Platform (GCP)**

> **Recommended for TrustFrame** due to its combination of managed container runtime, generous free tier, excellent managed PostgreSQL, native object storage, and the best per-GB pricing for media file egress in Asia-Pacific regions (relevant given DreamzTech Solutions context).

### 3.2 Reasoning

| Factor | GCP | AWS | Azure |
|---|---|---|---|
| **Container runtime** | Cloud Run (serverless containers, pay-per-request) — perfect for a monolith that has variable load | ECS Fargate or App Runner — similar capability but more complex to configure | Azure Container Apps — comparable but smaller ecosystem |
| **Managed PostgreSQL** | Cloud SQL (PostgreSQL 16) — native support, automated backups, point-in-time recovery | RDS PostgreSQL — gold standard, slightly higher cost | Azure Database for PostgreSQL Flexible Server — very good |
| **Object storage** | Cloud Storage (GCS) — S3-compatible API via `google-cloud-storage`, low egress cost in Asia | S3 — industry standard, highest ecosystem support | Azure Blob — good but higher egress cost |
| **Static frontend** | Cloud Run + nginx OR Firebase Hosting (free CDN, instant deploys) | S3 + CloudFront — powerful but more moving parts | Azure Static Web Apps — excellent for React, CI/CD built-in |
| **Free tier** | Cloud Run 2M requests/month free; Cloud Storage 5 GB free; Cloud SQL has no free tier (cheapest ~$7/month) | EC2 t2.micro 1 year free; RDS free tier 750 hrs/month (1 year only) | Azure App Service F1 (very limited); no free managed PostgreSQL |
| **Secrets management** | GCP Secret Manager — $0.06/10K accesses; 6 secrets free | AWS Secrets Manager — $0.40/secret/month | Azure Key Vault — $0.03/10K operations |
| **Observability** | Cloud Logging + Cloud Monitoring built-in, free up to 50 GB/month logs | CloudWatch — $0.76/GB ingested; gets expensive | Azure Monitor — similar to CloudWatch pricing |
| **CDN / media delivery** | Cloud CDN (per GiB pricing); or use GCS public bucket directly | CloudFront — flexible, mature | Azure CDN — good |
| **Pricing in INR region** | asia-south1 (Mumbai) region available; competitive pricing | ap-south-1 (Mumbai) available; AWS premium pricing | Central India available; mid-tier pricing |
| **Developer experience** | `gcloud` CLI is excellent; Cloud Console is clean | AWS Console is powerful but complex for newcomers | Azure Portal is improving but still verbose |

### 3.3 Trade-offs vs Other Platforms

**Why NOT AWS for this project right now:**
- Higher baseline cost for small deployments (ECS Fargate minimum ~$20-30/month vs Cloud Run ~$0-5/month at low traffic)
- More complex IAM and VPC setup for a POC-to-production transition
- Secrets Manager charges per secret per month regardless of usage

**Why NOT Azure:**
- No free managed PostgreSQL tier at any scale
- Azure Container Apps has had reliability issues at small scales
- Slightly higher egress costs for media files

**Alternative worth considering: DigitalOcean App Platform**
- Simpler than all three hyperscalers
- App Platform supports Docker containers natively
- Managed PostgreSQL $15/month (1 GB)
- Spaces (object storage, S3-compatible) $5/month for 250 GB
- **Best choice if team wants minimal DevOps overhead and budget is very tight**
- Downside: smaller ecosystem, less enterprise compliance (no SOC2 at App Platform level)

---

## 4. Required Cloud Services

All services are on **Google Cloud Platform** unless noted.

### 4.1 Compute

**Service**: Cloud Run  
**Purpose**: Runs the FastAPI backend container. Scales to zero when idle; scales out automatically under load.  
**Why**: The backend is stateless (after migrating file storage to GCS). Cloud Run is serverless — zero cost when idle, sub-second cold starts for Python containers. No cluster management.  
**Sizing**: 1 vCPU, 512 MB RAM per instance; max-instances: 3 (small), 10 (medium), 50+ (large). Concurrency: 80 requests/instance.

**Service**: Firebase Hosting  
**Purpose**: Serves the React static build (HTML/JS/CSS) with global CDN.  
**Why**: Free tier covers most POC traffic. Instant deploys via `firebase deploy`. SPA routing handled natively. No nginx container needed for the frontend in production.  
**Sizing**: Free tier (10 GB storage, 360 MB/day transfer).

### 4.2 Database

**Service**: Cloud SQL for PostgreSQL  
**Purpose**: Managed PostgreSQL 16 database replacing the Docker-based `db` service.  
**Why**: Automated backups, point-in-time recovery, high availability option, managed patching, connection pooling via Cloud SQL Auth Proxy.  
**Sizing**: `db-f1-micro` (1 shared vCPU, 614 MB RAM, 10 GB SSD) for small; `db-g1-small` (1 shared vCPU, 1.7 GB RAM, 20 GB SSD) for medium; `db-n1-standard-2` (2 vCPU, 7.5 GB RAM) for large.

### 4.3 Object Storage (replaces local `uploads/` volume)

**Service**: Google Cloud Storage (GCS)  
**Purpose**: Stores all uploaded images and videos. Replaces `LocalStorage` service.  
**Why**: Durable, replicated, globally accessible, S3-compatible. Supports signed URLs for secure media access. Required for horizontal scaling of Cloud Run instances.  
**Sizing**: Standard storage class. 50 GB for small; 500 GB for medium; multi-TB for large.

### 4.4 CDN (Media Delivery)

**Service**: Cloud CDN (fronting GCS)  
**Purpose**: Caches and serves media files from GCS close to end-users. Reduces GCS egress costs and latency.  
**Why**: Evidence reports are shared publicly — CDN improves share link load time significantly.  
**Sizing**: Enable on GCS backend; pay per cache miss egress only.

### 4.5 Secrets Management

**Service**: GCP Secret Manager  
**Purpose**: Stores `DATABASE_URL`, `SECRET_KEY`, `REPORT_TOKEN_SECRET`, `ADMIN_SECRET`, GCS credentials.  
**Why**: Eliminates hardcoded secrets in docker-compose / environment variables. Cloud Run can reference secrets directly.  
**Sizing**: Up to 6 secret versions free. Beyond that, $0.06 per 10K access operations.

### 4.6 Container Registry

**Service**: Artifact Registry  
**Purpose**: Stores Docker images for the backend container.  
**Why**: Native GCP registry; integrated with Cloud Run deployments; vulnerability scanning available.  
**Sizing**: 0.5 GB/month storage (free tier). Beyond first 0.5 GB: $0.10/GB/month.

### 4.7 CI/CD

**Service**: GitHub Actions (with `google-github-actions/deploy-cloudrun`)  
**Purpose**: On push to `main`: run pytest → build Docker image → push to Artifact Registry → deploy to Cloud Run → run `alembic upgrade head`.  
**Why**: GitHub Actions is free for public repos and 2,000 min/month for private repos. Native GCP deployment actions available. No cost increase to GCP.  
**Sizing**: Free tier (2,000 minutes/month on GitHub).

### 4.8 Monitoring and Logging

**Service**: Cloud Logging + Cloud Monitoring  
**Purpose**: Aggregate JSON logs from Cloud Run; alert on error rate spikes, latency, and instance count.  
**Why**: Built into GCP — no extra setup. Cloud Run forwards stdout/stderr automatically. Alert policies can page via email, SMS, or PagerDuty.  
**Sizing**: First 50 GB logs/month free. Monitoring: basic metrics free; custom metrics $0.18/metric/month.

### 4.9 Networking / DNS / TLS

**Service**: Cloud Load Balancing + Cloud Armor (optional) + Cloud DNS  
**Purpose**: HTTPS termination, custom domain (`api.trustframe.com`), DDoS protection.  
**Why**: Cloud Run provides a managed HTTPS URL by default (`*.run.app`). For a custom domain, Cloud Load Balancing provides SSL cert provisioning and Cloud Armor adds WAF rules.  
**Sizing**: Managed SSL cert: free. Load balancer ingress: $0.025/GB processed. Cloud DNS: $0.20/hosted zone/month.

### 4.10 (Optional) Caching

**Service**: Memorystore for Redis  
**Purpose**: Rate limiting state, session caching, report token cache.  
**Why**: Currently slowapi uses in-memory state — this is lost on every Cloud Run instance restart. Redis would centralize rate limit counters across all instances.  
**Sizing**: Basic tier, 1 GB: ~$20/month. Not required for small-scale deployments.

---

## 5. Monthly Cost Report

> All prices are approximate USD, based on GCP pricing in `asia-south1` (Mumbai) region as of April 2026. INR conversion: multiply USD by ~83.

### 5.1 Cost Table

| Service | Use Case | Configuration | Small (Dev/Low Traffic) | Medium (Production) | Large (High Traffic) |
|---|---|---|---|---|---|
| **Cloud Run** | Backend API container | 1 vCPU / 512 MB, 0–3 instances, ~50K req/month | **$0–2** (free tier covers most) | **$15–30** (3 instances, ~1M req/month) | **$80–200** (10+ instances, auto-scale) |
| **Firebase Hosting** | React SPA CDN | 10 GB storage, < 360 MB/day bandwidth | **$0** (free tier) | **$0–5** (Blaze plan, pay-as-you-go) | **$10–30** (high CDN egress) |
| **Cloud SQL (PostgreSQL 16)** | Managed database | db-f1-micro / db-g1-small / db-n1-standard-2, 10–50 GB SSD | **$7–15** (f1-micro, 10 GB) | **$30–60** (g1-small, 20 GB, HA off) | **$150–300** (n1-standard-2, HA on, 100 GB) |
| **Cloud Storage (GCS)** | Media file storage | Standard class, 50/500/5000 GB | **$1–3** (50 GB, low operations) | **$10–20** (500 GB + moderate ops) | **$100–300** (5 TB + high ops) |
| **Cloud CDN** | Media delivery / caching | Enable on GCS backend | **$0–2** (low egress) | **$5–15** (moderate egress, cache hits reduce cost) | **$30–100** (high egress, multi-region) |
| **Secret Manager** | App secrets storage | 5–10 secret versions | **$0** (free tier: 6 secrets) | **$1–2** (< 10K accesses/month) | **$3–5** (high rotation / many accesses) |
| **Artifact Registry** | Docker image storage | 1–3 image tags, ~500 MB | **$0** (free 0.5 GB/month) | **$1–3** (multiple image versions) | **$5–10** (many versions kept) |
| **Cloud Logging** | Log aggregation | ~1 GB logs/month | **$0** (free 50 GB/month) | **$0–5** (< 50 GB) | **$10–30** (> 50 GB/month) |
| **Cloud Monitoring** | Metrics + alerting | Default + 2 custom metrics, 2 alert policies | **$0** (free tier) | **$2–5** | **$10–20** |
| **Cloud Load Balancing** | HTTPS + custom domain | 1 forwarding rule, managed SSL cert | **$0–5** (minimal traffic) | **$10–20** | **$30–60** |
| **Cloud DNS** | DNS hosting | 1 hosted zone, < 1M queries | **$0.50** | **$1–2** | **$3–5** |
| **Memorystore (Redis)** | Rate limiting / cache | Basic tier, 1 GB | **$0** (not needed at small scale) | **$20–25** (recommended) | **$40–80** (replicated, 5 GB) |

### 5.2 Monthly Total Estimates

| Scale | Description | Estimated Monthly Cost (USD) | Estimated Monthly Cost (INR) |
|---|---|---|---|
| **Small** | Dev / POC / < 100 users, < 50K requests/month | **$10–30** | ₹830 – ₹2,490 |
| **Medium** | Production, 100–1,000 active users, ~1M requests/month | **$90–165** | ₹7,470 – ₹13,695 |
| **Large** | High traffic, 10K+ users, multi-region, full HA | **$430–1,000+** | ₹35,690 – ₹83,000+ |

### 5.3 Main Cost Drivers

| Driver | Impact | Notes |
|---|---|---|
| **Cloud SQL** | High baseline | Fixed hourly cost even when idle. Largest fixed cost item. Use `db-f1-micro` for dev — stop instance when not needed. |
| **GCS egress** | Scales with video views | Users viewing video evidence generates egress. CDN caching reduces this significantly. |
| **Cloud Run CPU** | Scales with traffic | Billed per 100ms of CPU allocation. Idle instances (scale-to-zero) cost $0. |
| **Cloud Run memory** | Base cost | Memory billing is active during request processing only at scale-to-zero config. |
| **Media storage growth** | Cumulative | 500 MB upload/day = ~15 GB/month added storage. Plan retention policy. |

### 5.4 Free Tier Summary

| Service | Free Tier |
|---|---|
| Cloud Run | 2M requests/month, 360K GB-seconds/month CPU, 180K GB-seconds/month memory |
| Firebase Hosting | 10 GB storage, 360 MB/day bandwidth |
| Cloud Storage | 5 GB standard storage, 5K Class A ops, 50K Class B ops/month |
| Cloud Logging | 50 GB ingestion/month |
| Cloud Monitoring | Basic metrics, 5 dashboards |
| Secret Manager | 6 secret versions |
| Artifact Registry | 0.5 GB storage |

---

## 6. Step-by-Step Deployment Guide

### Prerequisites

- Google Cloud account with billing enabled
- `gcloud` CLI installed: https://cloud.google.com/sdk/docs/install
- Docker Desktop installed
- GitHub repository with the TrustFrame codebase

---

### Step 1: Pre-deployment Code Changes

Before deploying, apply these mandatory fixes:

**1a. Add `alembic upgrade head` to container startup**

Create `backend/entrypoint.sh`:
```bash
#!/bin/bash
set -e
echo "Running database migrations..."
alembic upgrade head
echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Update `backend/Dockerfile` to use the entrypoint:
```dockerfile
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
CMD ["/entrypoint.sh"]
```

**1b. Fix Alembic to read DATABASE_URL from environment**

Edit `backend/migrations/env.py` — find the `run_migrations_online` function and add:
```python
import os
config.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])
```

**1c. Add JSON structured logging to `backend/app/main.py`**

```python
import logging
import json

class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({"level": record.levelname, "msg": record.getMessage(), "logger": record.name})

handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logging.getLogger("uvicorn").handlers = [handler]
```

**1d. Replace `LocalStorage` with GCS-backed storage** (see Step 6 for GCS setup first, then come back)

Install dependency:
```bash
pip install google-cloud-storage
```

Add to `requirements.txt`:
```
google-cloud-storage>=2.14.0
```

Update `backend/app/services/storage.py` — add GCS upload alongside local save, or fully replace:
```python
from google.cloud import storage as gcs

class GCSStorage:
    def __init__(self, bucket_name: str):
        self.client = gcs.Client()
        self.bucket = self.client.bucket(bucket_name)

    def _subfolder(self, mime_type: str) -> str:
        return "images" if mime_type.startswith("image/") else "videos"

    async def save(self, file, mime_type: str):
        import hashlib, uuid, mimetypes
        ext = mimetypes.guess_extension(mime_type) or ""
        filename = f"{self._subfolder(mime_type)}/{uuid.uuid4()}{ext}"
        sha256 = hashlib.sha256()
        content = await file.read()
        sha256.update(content)
        blob = self.bucket.blob(filename)
        blob.upload_from_string(content, content_type=mime_type)
        return filename, sha256.hexdigest(), len(content)

    def get_url(self, path: str) -> str:
        return f"https://storage.googleapis.com/{self.bucket.name}/{path}"
```

---

### Step 2: GCP Project Setup

```bash
# Authenticate
gcloud auth login

# Create a new project (or use existing)
gcloud projects create trustframe-prod --name="TrustFrame"
gcloud config set project trustframe-prod

# Enable billing (required for Cloud SQL and Cloud Run beyond free tier)
# Do this via: https://console.cloud.google.com/billing

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  dns.googleapis.com
```

---

### Step 3: Set Up Secret Manager

```bash
# Store all application secrets
echo -n "postgresql://trustframe:<DB_PASSWORD>@/<DB_NAME>?host=/cloudsql/<INSTANCE_CONNECTION_NAME>" | \
  gcloud secrets create DATABASE_URL --data-file=-

echo -n "$(python -c 'import secrets; print(secrets.token_hex(32))')" | \
  gcloud secrets create SECRET_KEY --data-file=-

echo -n "$(python -c 'import secrets; print(secrets.token_hex(32))')" | \
  gcloud secrets create REPORT_TOKEN_SECRET --data-file=-

echo -n "$(python -c 'import secrets; print(secrets.token_hex(32))')" | \
  gcloud secrets create ADMIN_SECRET --data-file=-

# Replace <DB_PASSWORD>, <DB_NAME>, <INSTANCE_CONNECTION_NAME> after Step 4
```

---

### Step 4: Create Cloud SQL (PostgreSQL 16)

```bash
# Create PostgreSQL instance (this takes ~5 minutes)
gcloud sql instances create trustframe-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=asia-south1 \
  --storage-type=SSD \
  --storage-size=10GB \
  --backup \
  --backup-start-time=02:00

# Create database and user
gcloud sql databases create trustframe --instance=trustframe-db
gcloud sql users create trustframe \
  --instance=trustframe-db \
  --password=<STRONG_PASSWORD>

# Get the instance connection name (needed for DATABASE_URL)
gcloud sql instances describe trustframe-db --format='value(connectionName)'
# Output: trustframe-prod:asia-south1:trustframe-db

# Update the DATABASE_URL secret with the real connection name
echo -n "postgresql://trustframe:<PASSWORD>@/trustframe?host=/cloudsql/trustframe-prod:asia-south1:trustframe-db" | \
  gcloud secrets versions add DATABASE_URL --data-file=-
```

---

### Step 5: Create GCS Bucket for Media Files

```bash
# Create bucket (globally unique name required)
gcloud storage buckets create gs://trustframe-uploads-prod \
  --location=asia-south1 \
  --uniform-bucket-level-access

# Make media files publicly readable (for evidence report image display)
gcloud storage buckets add-iam-policy-binding gs://trustframe-uploads-prod \
  --member=allUsers \
  --role=roles/storage.objectViewer

# Enable CORS for browser uploads (if direct-to-GCS uploads are added later)
cat > cors.json << 'EOF'
[{"origin": ["*"], "method": ["GET"], "responseHeader": ["Content-Type"], "maxAgeSeconds": 3600}]
EOF
gcloud storage buckets update gs://trustframe-uploads-prod --cors-file=cors.json
```

---

### Step 6: Create Artifact Registry and Build Backend Image

```bash
# Create Docker repository
gcloud artifacts repositories create trustframe-backend \
  --repository-format=docker \
  --location=asia-south1 \
  --description="TrustFrame backend images"

# Configure Docker authentication
gcloud auth configure-docker asia-south1-docker.pkg.dev

# Build and push the backend image
cd backend
docker build -t asia-south1-docker.pkg.dev/trustframe-prod/trustframe-backend/api:latest .
docker push asia-south1-docker.pkg.dev/trustframe-prod/trustframe-backend/api:latest
```

---

### Step 7: Deploy Backend to Cloud Run

```bash
# Create a service account for Cloud Run
gcloud iam service-accounts create trustframe-backend-sa \
  --display-name="TrustFrame Backend Service Account"

SA_EMAIL="trustframe-backend-sa@trustframe-prod.iam.gserviceaccount.com"

# Grant permissions
gcloud projects add-iam-policy-binding trustframe-prod \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding trustframe-prod \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin"

gcloud secrets add-iam-policy-binding DATABASE_URL \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding SECRET_KEY \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding REPORT_TOKEN_SECRET \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding ADMIN_SECRET \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/secretmanager.secretAccessor"

# Deploy to Cloud Run
gcloud run deploy trustframe-backend \
  --image=asia-south1-docker.pkg.dev/trustframe-prod/trustframe-backend/api:latest \
  --region=asia-south1 \
  --platform=managed \
  --service-account=${SA_EMAIL} \
  --add-cloudsql-instances=trustframe-prod:asia-south1:trustframe-db \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,SECRET_KEY=SECRET_KEY:latest,REPORT_TOKEN_SECRET=REPORT_TOKEN_SECRET:latest,ADMIN_SECRET=ADMIN_SECRET:latest" \
  --set-env-vars="UPLOAD_DIR=/tmp/uploads,GCS_BUCKET=trustframe-uploads-prod,MAX_UPLOAD_SIZE_MB=500,APP_URL=https://api.trustframe.com,CORS_ORIGINS=[\"https://trustframe.com\"]" \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --concurrency=80 \
  --timeout=120 \
  --allow-unauthenticated \
  --port=8000

# Note the service URL
gcloud run services describe trustframe-backend --region=asia-south1 --format='value(status.url)'
# Example: https://trustframe-backend-xxxxxxxx-el.a.run.app
```

---

### Step 8: Deploy Frontend to Firebase Hosting

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize Firebase in the frontend directory
cd frontend
firebase init hosting
# - Select: Use an existing project → trustframe-prod
# - Public directory: dist
# - Configure as SPA: Yes
# - Overwrite index.html: No

# Build the React app (VITE_API_URL empty = relative, handled by routing)
VITE_API_URL="" npm run build

# Deploy
firebase deploy --only hosting
# Output: Hosting URL: https://trustframe-prod.web.app
```

**Set up custom domain** (optional):
```bash
firebase hosting:channel:deploy production
# Then go to Firebase Console → Hosting → Add custom domain → trustframe.com
```

---

### Step 9: Configure Custom Domain and HTTPS (Optional)

```bash
# Set up Cloud DNS zone
gcloud dns managed-zones create trustframe-zone \
  --dns-name=trustframe.com \
  --description="TrustFrame DNS"

# Add API subdomain pointing to Cloud Run
gcloud dns record-sets create api.trustframe.com \
  --zone=trustframe-zone \
  --type=CNAME \
  --ttl=300 \
  --rrdatas=ghs.googlehosted.com.

# Cloud Run custom domain mapping
gcloud run domain-mappings create \
  --service=trustframe-backend \
  --domain=api.trustframe.com \
  --region=asia-south1
# GCP will provision a managed SSL certificate automatically
```

---

### Step 10: Set Up CI/CD with GitHub Actions

Create `.github/workflows/deploy.yml` in the repository root:

```yaml
name: Deploy TrustFrame

on:
  push:
    branches: [main]

env:
  PROJECT_ID: trustframe-prod
  REGION: asia-south1
  SERVICE: trustframe-backend
  IMAGE: asia-south1-docker.pkg.dev/trustframe-prod/trustframe-backend/api

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -r backend/requirements.txt
      - run: cd backend && pytest tests/ -v

  deploy:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write

    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to GCP
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}

      - name: Configure Docker
        run: gcloud auth configure-docker ${{ env.REGION }}-docker.pkg.dev

      - name: Build and push backend image
        run: |
          docker build -t ${{ env.IMAGE }}:${{ github.sha }} ./backend
          docker push ${{ env.IMAGE }}:${{ github.sha }}

      - name: Deploy to Cloud Run
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: ${{ env.SERVICE }}
          region: ${{ env.REGION }}
          image: ${{ env.IMAGE }}:${{ github.sha }}

      - name: Build and deploy frontend
        run: |
          cd frontend
          npm ci
          VITE_API_URL="" npm run build
          npm install -g firebase-tools
          firebase deploy --only hosting --token ${{ secrets.FIREBASE_TOKEN }}
```

---

### Step 11: Set Up Monitoring and Alerting

```bash
# Create uptime check for the health endpoint
gcloud monitoring uptime-check-configs create trustframe-health \
  --display-name="TrustFrame Health Check" \
  --http-check-path="/health" \
  --monitored-resource-type=uptime_url \
  --hostname=$(gcloud run services describe trustframe-backend --region=asia-south1 --format='value(status.url)' | sed 's|https://||')

# Create alert policy for error rate > 1%
# (Best done via Console: Monitoring → Alerting → Create Policy → Cloud Run Request Count filter by response_code_class=5xx)
```

**Log-based alert for upload errors** (via Console or `gcloud`):
```bash
gcloud logging metrics create upload_errors \
  --description="Count of 5xx errors on /api/uploads" \
  --log-filter='resource.type="cloud_run_revision" httpRequest.requestUrl=~"/api/uploads" httpRequest.status>=500'
```

---

### Step 12: Verify the Deployment

```bash
# Health check
curl https://trustframe-backend-xxxxxxxx-el.a.run.app/health
# → {"status": "ok", "version": "1.0.0"}

# Admin stats
curl https://trustframe-backend-xxxxxxxx-el.a.run.app/api/admin/stats \
  -H "X-Admin-Secret: <YOUR_ADMIN_SECRET>"
# → {"total_sessions": 0, "total_events": 0, "total_uploads": 0, "total_reports": 0}

# Frontend
open https://trustframe-prod.web.app
```

---

## Summary

| Item | Choice | Cost at Small Scale |
|---|---|---|
| Cloud Platform | **Google Cloud Platform** | — |
| Backend Compute | Cloud Run (serverless) | ~$0–2/month |
| Database | Cloud SQL PostgreSQL 16 | ~$7–15/month |
| File Storage | Google Cloud Storage | ~$1–3/month |
| Frontend CDN | Firebase Hosting | $0 (free tier) |
| Secrets | GCP Secret Manager | $0 (free tier) |
| CI/CD | GitHub Actions | $0 (free tier) |
| Monitoring | Cloud Logging + Monitoring | $0 (free tier) |
| **Total (small)** | | **~$10–25/month** |
| **Total (medium)** | | **~$90–165/month** |
| **Total (large)** | | **~$430–1,000+/month** |

**Recommended deployment order**: Step 1 (code fixes) → Step 2 (GCP project) → Step 3 (secrets) → Step 4 (database) → Step 5 (GCS) → Step 6 (Artifact Registry) → Step 7 (Cloud Run) → Step 8 (Firebase) → Step 10 (CI/CD) → Step 11 (monitoring).
