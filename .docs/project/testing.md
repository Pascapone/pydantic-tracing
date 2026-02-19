# Testing Setup

This project uses three test layers:

| Layer | Tooling | Primary command |
|---|---|---|
| Frontend unit/integration | Vitest + RTL | `npm run test:unit` |
| End-to-end | Playwright | `npm run test:e2e` |
| Python worker tests | Pytest in project venv | `npm run test:py` |

## Command Reference

If PowerShell execution policy blocks `npm.ps1`, run commands through `cmd`:

```bash
cmd /c npm run test:unit
```

### Unit tests (frontend)

```bash
npm run test:unit
```

### Python tests (must use `python-workers/.venv`)

```bash
npm run test:py
```

Equivalent explicit command:

```bash
./python-workers/.venv/Scripts/python.exe -m pytest python-workers/tests -q
```

`npm run test:py` adds `-p no:cacheprovider` and an ignore glob for stale `pytest-cache-files-*` directories to avoid Windows permission edge cases.

### E2E tests (recommended local flow)

Two-terminal warm-server flow:

```bash
# Terminal A
npm run dev:test

# Terminal B
npm run test:e2e:preflight
npm run test:e2e
```

Run only trace flow:

```bash
npm run test:e2e:traces
```

## E2E Reliability Notes

- Base URL defaults to `http://127.0.0.1:3341`.
- Playwright config (`playwright.config.ts`) does not use `webServer` to avoid known Nitro startup flakiness.
- `npm run test:e2e` and related commands run `scripts/e2e-preflight.mjs` first.
- Preflight validates `/login` is reachable and not serving a Dokploy error page.
- E2E runs are serialized (`workers=1`) to reduce flakiness around shared state and local services.
- Failure artifacts are written to `playwright-report/` and `test-results/` (ignored by git).

## Troubleshooting

### Dokploy `400 - Oops, something went wrong`

Symptoms: browser opens app URL but shows Dokploy error page.

Actions:
1. Ensure Dokploy-related services/containers are stopped or scaled down.
2. Verify your app is actually listening on `127.0.0.1:3341`.
3. Retry with manual server flow first (`npm run dev:test` + `npm run test:e2e`).

### `NitroViteError: Vite environment "nitro" is unavailable`

Symptoms: appears when test tooling uses the flaky startup path for the dev server.

Actions:
1. Use the manual warm-server flow (`npm run dev:test` then `npm run test:e2e`).
2. If needed, stop server, clear Vite cache (`node_modules/.vite`), restart `npm run dev:test`, rerun E2E.

### `/traces` shows `No traces yet`

Actions:
1. Ensure test creates an `agent.run` job, not only generic queue jobs.
2. Confirm payload includes user context (`userId` / `user_id`) so user-filtered traces appear.
