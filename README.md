# TrustFrame — Proof of Concept

> **Tamper-Proof Evidence, Now.** A mobile-first, cryptographically-verified evidence capture and sharing platform.

---

## Overview

TrustFrame is a mobile web application that allows users to:

1. Capture or upload photo/video evidence
2. Automatically compute a SHA-256 cryptographic hash of the raw binary
3. Capture GPS, timestamp, and device metadata at the moment of upload
4. Tag evidence to an event channel
5. Generate a shareable, tamper-evident evidence report

---

## Architecture

| Layer | Tech |
|-------|------|
| Backend API | **FastAPI** (Python) + SQLAlchemy ORM |
| Database | **PostgreSQL** |
| File Storage | Local filesystem (S3-compatible abstraction) |
| Frontend | **React** (Vite) |
| Container | Docker + Docker Compose |

---

## Quick Start (Docker)

### Prerequisites
- Docker Desktop installed and running

### Steps

```bash
# 1. Clone the repo and enter the project directory
cd trustframe

# 2. Copy and edit environment variables
cp .env.example .env
# Edit .env with your preferred secrets

# 3. Build and launch
docker compose up --build

# App will be available at:
#   Frontend:  http://localhost
#   Backend:   http://localhost:8000
#   API docs:  http://localhost:8000/docs
```

---

## Local Development (without Docker)

### Backend

```bash
# 1. Install Python 3.11+
cd backend

# 2. Create a virtual environment
python -m venv .venv
source .venv/bin/activate      # macOS/Linux
# or
.venv\Scripts\activate         # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL to your PostgreSQL instance

# 5. Run database migrations (Alembic)
alembic upgrade head

# 6. Start the API server
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend

# 1. Install Node.js 20+
npm install

# 2. Configure API URL
cp .env.example .env.local
# VITE_API_URL=http://localhost:8000

# 3. Start dev server
npm run dev
```

Frontend: http://localhost:5173

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://trustframe:trustframe@localhost:5432/trustframe` |
| `SECRET_KEY` | App secret key | `change-me` |
| `REPORT_TOKEN_SECRET` | Secret for signing report tokens | `change-me` |
| `UPLOAD_DIR` | Local path for uploaded files | `./uploads` |
| `MAX_UPLOAD_SIZE_MB` | Maximum file size in MB | `500` |
| `CORS_ORIGINS` | JSON array of allowed origins | `["http://localhost:5173"]` |
| `ADMIN_SECRET` | Header secret for admin endpoints | `admin-password-change-me` |
| `APP_URL` | Public frontend URL (used in QR codes and report links) | `http://localhost:5173` |

### Frontend (`frontend/.env.local`)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API base URL | `http://localhost:8000` |

---

## API Reference

Interactive docs: **http://localhost:8000/docs**

### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/session/start` | Start a lightweight user session |
| `GET` | `/api/events` | List all event channels |
| `POST` | `/api/events` | Create a new event |
| `GET` | `/api/events/{code}` | Get event details |
| `GET` | `/api/events/{code}/qrcode` | Download event QR code (PNG) |
| `GET` | `/api/app-entry-qrcode` | Download app entry QR code (PNG) |
| `POST` | `/api/uploads` | Upload a media file (multipart) |
| `PATCH` | `/api/uploads/{asset_id}/event` | Associate upload with an event |
| `GET` | `/api/reports/{token}` | Get report data (JSON) |
| `GET` | `/api/admin/stats` | Admin: usage stats |
| `GET` | `/api/admin/uploads` | Admin: list uploads |
| `GET` | `/api/admin/events` | Admin: list events |
| `GET` | `/api/admin/reports` | Admin: list reports |

Admin endpoints require the `X-Admin-Secret` header.

---

## Running Tests

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```

Tests cover:
- SHA-256 hash correctness and determinism
- Session integrity hash generation
- Report token generation and validation
- Custody ledger append behavior

---

## Storage Configuration

By default files are stored on the local filesystem at `./uploads/`.

To switch to S3-compatible storage (future phase), implement the `LocalStorage` interface in `backend/app/services/storage.py`:

```python
class S3Storage:
    async def save(self, file: UploadFile) -> tuple[str, str, int]:
        ...
    def get_url(self, storage_path: str) -> str:
        ...
```

Then substitute it in `backend/app/routers/uploads.py`.

---

## User Flow

```
Landing Page ("Tamper-Proof Evidence, Now")
    ↓ Start Secure Session (name + phone — optional)
Capture Page
    ↓ Record Video  OR  Select from Gallery
    ↓ Review (preview + GPS + "Secure Upload")
Upload → Server computes SHA-256, captures metadata
    ↓
Tag an Event (optional)
    ↓ Create new event  OR  Select existing  OR  Skip
Evidence Report
    ↓ SHA-256 hash · GPS · Timestamp · Device · Chain of Custody
    ↓ Copy Shareable Link  OR  Native Share
```

---

## Security Notes

- All report URLs use a 256-bit random token (not guessable)
- Reports are not publicly indexed — security through obscurity + opaque tokens
- No passwords or JWTs stored on the client; only a session UUID in localStorage
- Admin endpoints require a shared secret header
- HTTPS termination assumed at the load balancer / reverse proxy level
- Files stored at-rest using OS/platform encryption (configure S3 SSE for production)

---

## Project Structure

```
trustframe/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI entrypoint
│   │   ├── config.py        # Settings (pydantic-settings)
│   │   ├── database.py      # SQLAlchemy engine + session
│   │   ├── models/          # ORM models
│   │   ├── schemas/         # Pydantic request/response models
│   │   ├── routers/         # API route handlers
│   │   └── services/        # Hashing, storage, QR, tokens
│   ├── migrations/          # Alembic migration files
│   ├── tests/               # Pytest unit tests
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/           # React page components
│   │   ├── components/      # Shared UI components
│   │   ├── context/         # Session context
│   │   └── services/        # API client
│   ├── index.html
│   ├── vite.config.js
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## Acceptance Criteria Status

| # | Criterion | Status |
|---|-----------|--------|
| AC1 | Upload via mobile web without app or account | ✅ |
| AC2 | SHA-256 hash generated and displayed for every upload | ✅ |
| AC3 | UTC timestamp and GPS captured on evidence report | ✅ |
| AC4 | Create Event Channel; others contribute via QR or link | ✅ |
| AC5 | Evidence report generated within 5s of upload | ✅ |
| AC6 | Report accessible via shareable URL without login | ✅ |
| AC7 | Report shows thumbnail, hash, timestamp, GPS, device info, tamper statement | ✅ |
| AC8 | Basic admin panel with upload/event/report counts | ✅ |

---

*TrustFrame POC — Built by DreamzTech Solutions, April 2026*
