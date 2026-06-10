# ConcreteDSS — Sustainable Concrete Mix Decision Support System

Multi-objective concrete mix optimizer. Balance **CO₂ emissions**, **material cost** and
**compressive strength** on an interactive 3D Pareto front, save scenarios to your account,
compare them, and export PDF reports.

## Architecture

```
frontend/  Next.js 16 + TypeScript + Tailwind     →  HTTP  →  backend/  FastAPI (Python)
   │  NextAuth (email/password), Prisma                          │  ML + NSGA-II + PDF
   ▼                                                             ▼
Supabase Postgres  (users, saved scenarios)        (real data, model-predicted strength)
```

- **backend/** — FastAPI, stateless. Trains an ML model on the real **UCI Concrete
  Compressive Strength** dataset to predict strength, runs **NSGA-II** multi-objective
  optimization to generate Pareto-optimal mixes (min CO₂, min cost, max strength) under
  engineering constraints, computes CO₂/cost from literature-based factors, and produces
  scenario PDF reports. No database access.
- **frontend/** — Next.js app. UI, authentication (NextAuth credentials), and scenario
  persistence via Prisma → Supabase Postgres.

### Methodology

- **Strength prediction**: `GradientBoostingRegressor` (scikit-learn) trained on 1030 real
  samples — hold-out **R² ≈ 0.93**, RMSE ≈ 4.4 MPa, 5-fold CV R² ≈ 0.94.
- **Optimization**: NSGA-II (`pymoo`) generates new mix designs on the true 3-objective
  Pareto front; constraints: 0.30 ≤ w/c ≤ 0.65, 260 ≤ binder ≤ 550 kg/m³, density window,
  minimum strength. Objective weights then select the recommended mix via weighted sum
  (min-max normalized) — the front is cached by constraints so weight changes are instant.
- **CO₂ & cost**: literature-based emission factors (ICE database; Flower & Sanjayan 2007;
  EFCA EPDs) and indicative unit prices — all in `backend/config.py`, adjustable.
- **Dataset**: Yeh, I-C. (1998), *Cement and Concrete Research* 28(12), 1797–1808; UCI ML Repository.

## Prerequisites

- Node.js 20.9+ and **Python 3.11** (recommended — scientific wheels for pymoo/scikit-learn)
- A free [Supabase](https://supabase.com) project (used purely as the Postgres database)

## 1. Backend (FastAPI)

```bash
cd backend
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --reload --port 8000
```

On first run the backend downloads the UCI dataset and trains the model (a few seconds),
caching both to `data/` and `models/`. Run tests with `.venv/bin/pytest`.

Sanity check: `curl localhost:8000/api/health` → status + model metrics (R², RMSE).

### API

| Method | Path                  | Purpose                                                  |
| ------ | --------------------- | -------------------------------------------------------- |
| GET    | `/api/health`         | status + default ML model metrics                        |
| GET    | `/api/dataset`        | active dataset summary + source (`?user_id`/`?session_id`)|
| POST   | `/api/dataset/upload` | upload an industry dataset (.csv/.xls/.xlsx) → retrain   |
| POST   | `/api/dataset/reset`  | revert a scope to the default UCI dataset                |
| POST   | `/api/optimize`       | NSGA-II Pareto front + recommended mix (per scope)       |
| POST   | `/api/predict`        | strength/CO₂/cost for a single user-specified mix        |
| POST   | `/api/report`         | scenario PDF report                                      |

### Custom datasets (industry data)

Upload a mix dataset (.csv / .xls / .xlsx); the backend maps varied column names
(e.g. "Blast Furnace Slag" → slag) to canonical keys, validates and cleans the rows,
then **retrains the strength model** on it. Scope is set by the caller:

- **`user_id`** (logged-in user) → dataset + model are persisted on disk and survive restarts.
- **`session_id`** (anonymous; returned by the first upload) → kept in memory only (temporary).
- neither → the default UCI dataset/model.

```bash
curl -F file=@data.xlsx -F user_id=<id> localhost:8000/api/dataset/upload
```

`/api/optimize`, `/api/predict` and `/api/dataset` accept the same `user_id`/`session_id`
to operate against that scope. Required columns: the 7 mix components + compressive
strength (age optional, defaults to 28 days).

### Docker

```bash
cd backend
docker build -t concretedss-backend .   # dataset + model baked in at build time
docker run -p 8000:8000 concretedss-backend
```

## 2. Supabase

1. Create a Supabase project.
2. Project Settings → **Database → Connection string**. Copy both:
   - **Transaction pooler** (port `6543`) → `DATABASE_URL`
   - **Direct** (port `5432`) → `DIRECT_URL`

## 3. Frontend (Next.js)

Two env files (Prisma CLI only reads `.env`; Next.js reads both):

`frontend/.env` — database URLs (also gitignored):

| Variable       | Value                                                                 |
| -------------- | --------------------------------------------------------------------- |
| `DATABASE_URL` | Supabase **Transaction pooler** string (`:6543`, `?pgbouncer=true`)   |
| `DIRECT_URL`   | Supabase **Session pooler** string (`:5432`) — used for migrations    |

`frontend/.env.local` — app config:

| Variable             | Value                        |
| -------------------- | ---------------------------- |
| `NEXTAUTH_SECRET`    | `openssl rand -base64 32`    |
| `NEXTAUTH_URL`       | `http://localhost:3000`      |
| `NEXT_PUBLIC_API_URL`| `http://localhost:8000`      |

> Use the **pooler** connection strings (host `...pooler.supabase.com`), not the direct
> `db.<ref>.supabase.co` host — the latter is IPv6-only and usually unreachable from local dev.
> Supabase → **Connect → ORMs → Prisma** gives both strings prefilled.

Create the database tables and start the app:

```bash
npm install --legacy-peer-deps   # already done if you ran setup
npx prisma migrate dev --name init
npm run dev
```

Open http://localhost:3000.

## Features

- **Optimizer** (`/optimizer`, public): live 3D Pareto front, weight sliders, min-strength
  constraint, recommended-mix highlight, dynamic insights, dark mode.
- **Auth** (`/login`, `/register`): email + password via NextAuth.
- **Save scenario**: persists weights + constraint + recommended mix to your account.
- **Dashboard** (`/dashboard`): your saved scenarios — load, delete, export PDF.
- **Compare** (`/compare`): side-by-side comparison table (best value per metric starred).
- **PDF export**: scenario performance report generated by the FastAPI backend.

## Notes

- The optimizer is publicly viewable; saving, dashboard and compare require an account.
- All data is **simulated**. Results must be validated by physical lab testing and expert
  engineering review before any construction use.
