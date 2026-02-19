# Handoff: Testing Reliability Hardening (Playwright + Python + Docs)

## Session Metadata
- Created: 2026-02-19 19:40:12
- Project: C:\Users\pasca\Coding\tanstack-python-jobs
- Branch: main
- Session duration: ~4 hours

### Recent Commits (for context)
  - 0e03497 fixed nested tracing
  - 5a1747c problem with nested tracing
  - b4052fb details for function calling
  - 3b338ca details for function calling
  - 41bc73a react-json-view

## Handoff Chain

- **Continues from**: `.handoffs/2026-02-19-183834-e2e-tracing-recovery.md`
- **Supersedes**: `.handoffs/2026-02-19-144641-e2e-tracing-failure.md`

> This handoff continues the E2E stabilization thread after the prior recovery handoff.

## Current State Summary

The testing setup was hardened to match the known-good path from the previous handoff: warm/manual dev server + Playwright against an existing server, with explicit preflight checks. The flaky Playwright-managed server startup path (`webServer`) remains unreliable in this environment and is no longer the default flow. The updated commands were validated: frontend unit command runs cleanly, Python tests pass in the required venv, and the trace E2E test passes end-to-end when run through the warm-server workflow.

## Codebase Understanding

## Architecture Overview

This repo has three relevant test layers. Frontend unit tests use Vitest and load Vite config, so plugin behavior in `vite.config.ts` directly affects test startup. E2E tests use Playwright and depend on a running TanStack Start app on `127.0.0.1:3341`; in this environment, spawning the dev server from Playwright can trigger Nitro startup failures. Python worker tests depend on SQLite tracing internals and must run via `python-workers/.venv`; Windows file/permission quirks affected pytest cache/temp behavior and required defensive test configuration.

## Critical Files

| File | Purpose | Relevance |
|------|---------|-----------|
| `package.json` | Test command entry points | Canonical run commands were updated here (`test:unit`, `test:e2e*`, `test:py`, `test:e2e:preflight`) |
| `playwright.config.ts` | Playwright runtime behavior | Uses stable settings (`workers=1`, failure artifacts, no `webServer`) |
| `scripts/e2e-preflight.mjs` | Pre-run health check for E2E | Verifies `/login` is reachable and not a Dokploy error page before running tests |
| `.docs/project/testing.md` | Project testing runbook | Updated with exact commands and fallback guidance |
| `README.md` | Top-level quickstart testing guidance | Updated with current recommended testing commands |
| `AGENTS.md` | Agent/operator instructions | Added concise "how to run tests + gotchas" section |
| `vite.config.ts` | Shared Vite config for dev/test | Skips Nitro plugin in Vitest context to prevent unit test startup failures |
| `vitest.config.ts` | Vitest-specific config | Restricts unit test discovery to `src/**` and excludes E2E/Python folders |
| `python-workers/pyproject.toml` | Pytest behavior | Disables pytest cache provider and avoids recurse issues from inaccessible temp dirs |
| `python-workers/tracing/collector.py` | SQLite collector lifecycle | `reset_instance()` now closes connections to reduce DB lock teardown problems |
| `python-workers/tests/conftest.py` | Pytest fixtures for tracing tests | Uses workspace-local temp DB path and proper collector reset |
| `python-workers/tests/test_handler_events.py` | Handler event tests | Uses deterministic workspace-local DB files for reliability in this environment |
| `.gitignore` | Worktree hygiene | Ignores test artifacts/caches/db files that caused noisy dirty state |

### Key Patterns Discovered

- Prefer warm-server E2E flow: start app manually (`npm run dev:test`) then run Playwright.
- Gate E2E with preflight (`npm run test:e2e:preflight`) before actual browser execution.
- Keep E2E serialized (`workers=1`) due shared local services/state and environment flakiness.
- Keep Python tests inside `python-workers/.venv`; avoid system Python.
- For this repo, Vitest must not initialize Nitro plugin; test config excludes `e2e/**`.

## Work Completed

### Tasks Finished

- [x] Reviewed previous handoff and revalidated the root cause (flaky Playwright-managed startup path).
- [x] Hardened E2E command flow with explicit preflight gate.
- [x] Removed unstable one-command server orchestration path after proving it inconsistent here.
- [x] Stabilized Vitest startup by gating Nitro plugin when running under Vitest.
- [x] Stabilized Python test behavior for local DB files and collector connection teardown.
- [x] Updated testing docs (`.docs/project/testing.md`, `README.md`, `AGENTS.md`) with clear run commands and gotchas.
- [x] Verified command behavior locally (unit, python, and trace E2E pass in warm-server flow).

## Files Modified

| File | Changes | Rationale |
|------|---------|-----------|
| `package.json` | Reworked test scripts (`test:unit`, `test:e2e`, `test:e2e:preflight`, `test:e2e:traces`, `test:py`) | Provide explicit, reliable commands and fallback-friendly workflow |
| `playwright.config.ts` | Stable settings + no `webServer` usage | Avoid known Nitro startup flake in this environment |
| `scripts/e2e-preflight.mjs` | Added new script | Detect down server/Dokploy interception before running Playwright |
| `vite.config.ts` | Skip Nitro plugin when `VITEST=true` | Prevent Vitest startup crash |
| `vitest.config.ts` | Added dedicated test include/exclude | Avoid Playwright test file collection by Vitest |
| `python-workers/pyproject.toml` | `addopts = "-p no:cacheprovider"` + recurse exclusions | Avoid inaccessible pytest cache/temp directory issues |
| `python-workers/tests/conftest.py` | Workspace-local temp DB fixture + explicit collector reset | Improve deterministic DB behavior in tests |
| `python-workers/tests/test_handler_events.py` | Workspace-local DB paths and cleanup updates | Avoid tempfile directory edge cases with sqlite on this machine |
| `python-workers/tracing/collector.py` | Close SQLite connection in `reset_instance()` | Reduce file-lock teardown errors |
| `.docs/project/testing.md` | Rewritten runbook for current reliable flow | Ensure future sessions run tests correctly |
| `README.md` | Updated testing section commands | Keep top-level docs in sync |
| `AGENTS.md` | Added short testing commands + gotchas section | Ensure agent/operator behavior stays consistent |
| `.gitignore` | Added test artifact/cache/db ignores | Reduce worktree noise from generated files |

## Decisions Made

| Decision | Options Considered | Rationale |
|----------|-------------------|-----------|
| Keep Playwright on warm/manual server flow | Playwright-managed `webServer`, one-command wrapper, manual warm server | Manual warm server is the only path consistently passing here |
| Add preflight gate before E2E execution | Run Playwright directly, add preflight script | Fails fast on server-down/Dokploy conditions with actionable error |
| Run E2E in single worker | Parallel workers, serialized | Serial runs reduce local flakiness and shared state races |
| Skip Nitro plugin under Vitest | Keep shared plugin stack, add separate Vite config for tests | Smallest change to stop Vitest startup errors |
| Disable pytest cache provider for this repo | Keep cache and troubleshoot locked dirs deeply now | Reliable immediate fix; deep root cause can be deferred |

## Pending Work

## Immediate Next Steps

1. Stage and commit only the intended testing/doc changes (worktree contains many unrelated pre-existing modifications/deletions).
2. Optionally add a CI-specific E2E profile that can safely use a managed server in CI while keeping local warm-server flow default.
3. Optionally investigate and clean locked `pytest-cache-files-*` directories with admin-level host tooling if needed.

### Blockers/Open Questions

- [ ] Windows permission-denied directories exist from prior pytest runs (`python-workers/tests/pytest-cache-files-*` and nested variants); they cannot be removed from this environment even with elevated attempts.
- [ ] Root-cause of Nitro failure under Playwright-managed startup is still unresolved; behavior is mitigated by workflow, not fixed at source.

### Deferred Items

- Deep diagnosis of `NitroViteError` during Playwright `webServer` startup (deferred because warm-server flow is stable and unblocks testing immediately).
- Root-cause cleanup of inaccessible pytest temp/cache directories (deferred because tests pass with cache provider disabled).

## Context for Resuming Agent

## Important Context

The key reliability rule is: do not use Playwright-managed server startup as the default local path in this environment. Start the server manually (`npm run dev:test`) and then run E2E commands that include preflight (`npm run test:e2e:preflight`, then `npm run test:e2e` or `npm run test:e2e:traces`). This matches the previous handoff's known-good behavior and was revalidated in this session with a full passing trace E2E run. Python tests must run via `python-workers/.venv`; command `npm run test:py` now passes reliably. Unit tests use `npm run test:unit` and are stable after Vitest config isolation and Nitro plugin gating.

## Assumptions Made

- Dokploy services are not intercepting traffic on `127.0.0.1:3341` during E2E runs.
- Playwright browsers are already installed in the local environment.
- Existing auth/job/trace functionality from earlier sessions (including `agent.run` user context propagation) remains in place.

## Potential Gotchas

- `npm run test:e2e` will fail immediately if server is not running; this is expected because preflight is now enforced.
- PowerShell execution policy may block `npm.ps1`; use `cmd /c npm run <script>` if needed.
- Worktree is heavily dirty with unrelated files; avoid resetting/reverting unrelated changes.
- Always stop leftover dev servers after tests to prevent stale listeners on `3341`.
- Avoid using system Python for worker tests; use only `./python-workers/.venv/Scripts/python.exe`.

## Environment State

### Tools/Services Used

- Vite dev server on `127.0.0.1:3341` (`npm run dev:test`)
- Playwright (`@playwright/test`) with Chromium, single-worker runs
- Vitest with dedicated config (`vitest.config.ts`)
- Python pytest via `python-workers/.venv`

### Active Processes

- No intentional long-running process left active at handoff time (dev server was stopped after validation).

### Environment Variables

- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `REDIS_URL`
- `PYTHON_PATH`
- `MAX_PYTHON_WORKERS`
- `OPENROUTER_API_KEY`
- `PLAYWRIGHT_BASE_URL` (optional override for E2E base URL)

## Related Resources

- Previous handoff: `.handoffs/2026-02-19-183834-e2e-tracing-recovery.md`
- Earlier blocker analysis: `.handoffs/2026-02-19-144641-e2e-tracing-failure.md`
- Testing runbook: `.docs/project/testing.md`
- Agent run instructions: `AGENTS.md`
- E2E spec: `e2e/traces.spec.ts`
- Playwright config: `playwright.config.ts`
- E2E preflight script: `scripts/e2e-preflight.mjs`

---

**Security Reminder**: Before finalizing, run `validate_handoff.py` to check for accidental secret exposure.
