# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

PolyWeather Pro: weather-intelligence for Polymarket temperature settlement markets (52 cities). See `README.md` (EN) / `README_ZH.md`; most deep docs in `docs/` are Chinese (`*_ZH.md`). `AGENTS.md` holds the Codex/OMX agent contract, including the Lore commit-message protocol (intent line + trailers like `Constraint:`, `Rejected:`, `Tested:`).

## Commands

Backend (Python 3.11, run from repo root — CI mirrors this):

```bash
pip install -r requirements.txt -r requirements-dev.txt
python -m ruff check .
python -m pytest                                   # testpaths = tests
python -m pytest tests/test_market_alert_engine.py::test_name   # single test
python web/app.py                                  # FastAPI on :8000
python run.py                                      # Telegram bot (spawns bot_listener.py)
docker compose up -d --build                       # bot + web; profiles: workers (prewarm), monitoring
```

Frontend (`frontend/`, Node 20, Next.js 15 / React 19):

```bash
npm ci
npm run dev
npm run test:business   # custom runner: transpiles TS and runs components/dashboard/scan-terminal/__tests__
npm run build           # CI gate (also typechecks); no ESLint config yet, so skip `npm run lint`
```

## Architecture

- **`src/`** — shared domain core used by both the web API and the bot:
  - `data_collection/` — per-source fetchers (METAR/TAF, Open-Meteo, MGM, JMA AMeDAS, KMA, NMC, HKO/CWA, settlement sources), `city_registry.py` (city definitions), `weather_sources.py` (`WeatherDataCollector` aggregator), Polymarket read-only layer + WS cache.
  - `analysis/` — DEB multi-model blending (`deb_algorithm.py`), trend engine, probability calibration (legacy / EMOS / rollout modes), settlement rounding, market alert engine.
  - `models/` — LightGBM daily-high model + features. Training/backfill/eval live in `scripts/`.
  - `database/` — SQLite runtime state is the primary store; legacy JSON/JSONL only for migration/fallback.
  - `payments/`, `onchain/`, `contracts/` — Polygon USDC checkout contract, event listener + confirm loop.
  - `auth/` — Supabase entitlement checks (bearer token).
  - `bot/` — Telegram bot (orchestrator, handlers, command guard).
- **`web/`** — FastAPI backend. `core.py` builds the `app` and shared context, `routes.py` the router, `analysis_service.py` builds city summary/detail payloads; `scan_terminal_*` / `scan_city_ai_*` power the market scan terminal and AI airport reads.
- **`frontend/`** — Next.js app (deployed on Vercel). Browser code talks to Next route handlers under `app/api/**`, which proxy to the FastAPI backend via `POLYWEATHER_API_BASE_URL` (`lib/api-proxy.ts`, `lib/backend-api.ts`). `/ops` is the admin dashboard.
- **`config/config.yaml`** + `.env` (see `.env.example`, `docs/CONFIGURATION_ZH.md`); validated by `src/utils/config_validation.py` / `scripts/validate_runtime_env.py`.
- **`extension/`** is the browser extension.

## Notes

- Production probability should stay on `legacy` or `emos_shadow`; `emos_primary` only after offline evaluation and manual rollout.
- Release version: `python scripts/bump_version.py [patch|minor|major|X.Y.Z]` updates `VERSION` + `CHANGELOG.md`, then `python scripts/sync_version.py` rewrites version strings in README/docs. `frontend/package.json` is bumped by hand.
