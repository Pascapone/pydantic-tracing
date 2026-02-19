# Handoff: E2E Tracing Recovery and Test Infra Stabilization

## Session Metadata
- Created: 2026-02-19 18:38:34
- Project: C:\Users\pasca\Coding\tanstack-python-jobs
- Branch: main
- Session duration: ~3 hours

### Recent Commits (for context)
  - 0e03497 fixed nested tracing
  - 5a1747c problem with nested tracing
  - b4052fb details for function calling
  - 3b338ca details for function calling
  - 41bc73a react-json-view

## Handoff Chain

- **Continues from**: `.handoffs/2026-02-19-144641-e2e-tracing-failure.md`
- **Supersedes**: None

## Current State Summary

This session investigated and fixed E2E testing instability around `/login -> /jobs -> /traces`. The major blockers were: (1) Dokploy auto-restarting via Docker Swarm services, (2) Playwright-managed `webServer` startup intermittently failing with `NitroViteError`, (3) stale E2E selectors, and (4) traces not appearing for the logged-in user due to missing user context in `agent.run` payloads. The critical functional fix is now in place and the updated Playwright test passed end-to-end.

## Codebase Understanding

## Architecture Overview

- `/traces` reads from Python `traces.db` via `/api/traces`.
- `TraceTerminal` passes `userId` to `useTraces`, so trace listing is user-filtered.
- Jobs are created in `src/lib/queue/index.ts` and executed via Python workers from `src/lib/queue/worker.ts`.
- `agent.run` traces are generated in `python-workers/handlers/agent_trace.py` and depend on payload context (`userId`/`user_id`).
- Playwright works more reliably with a manually started dev server (`reuseExistingServer`) than when spawning the server itself in this environment.

## Critical Files

| File | Purpose | Relevance |
|------|---------|-----------|
| `e2e/traces.spec.ts` | E2E flow for login, job creation, and traces UI verification | Updated selectors/flow; now passing |
| `src/lib/queue/index.ts` | Queue job creation and payload shaping | Fixed missing `userId` propagation for `agent.run` |
| `playwright.config.ts` | Playwright base URL and web server behavior | Existing config still uses `webServer`; local reliability depends on reuse/manual server |
| `src/components/tracing/TraceTerminal.tsx` | Uses `useTraces({ userId })` | Explains why traces were hidden when `user_id` was missing |
| `src/lib/hooks/use-jobs.ts` | Job templates and UI labels | E2E needed updated selectors (`Start AI Agent`) |
| `python-workers/handlers/agent_trace.py` | Trace creation and metadata | Consumes `userId`/`user_id` from payload |

### Key Patterns Discovered

- The app has frequent UI text changes; E2E selectors should be role/label based and avoid brittle text assumptions.
- `TraceTimeline` filters `model.request` spans, so E2E assertions should target visible labels (e.g., `Agent Run`, `Tool Call`, `Model Response`).
- In this environment, Vite optimize cache and startup timing can produce transient `504 Outdated Optimize Dep`; warm server + retries help.
- Docker Swarm service reconciliation can recreate containers even when manual container stop/delete is done.

## Work Completed

### Tasks Finished

- [x] Investigated root causes across infra, Playwright, and app behavior.
- [x] Confirmed Dokploy autostart source (Docker Swarm services with replicas/restart policy).
- [x] Verified and reproduced Playwright-managed startup `NitroViteError`.
- [x] Updated E2E script to current UI and stabilized login/traces interactions.
- [x] Fixed queue payload propagation for `agent.run` so traces appear under user-filtered `/traces`.
- [x] Verified final E2E run passed.

## Files Modified

| File | Changes | Rationale |
|------|---------|-----------|
| `e2e/traces.spec.ts` | Updated selectors, added signup-mode retry/fallback, switched flow to `AI Agent`, improved trace sidebar targeting/assertions | Align test with current UI and make it robust/stable |
| `src/lib/queue/index.ts` | Inject `userId` and `user_id` for `agent.run` payloads when missing | Ensure Python traces are associated with the logged-in user so `/traces` can list them |

## Decisions Made

| Decision | Options Considered | Rationale |
|----------|-------------------|-----------|
| Use manual/warm dev server for E2E runs | Keep Playwright-managed `webServer` startup | Playwright-spawned server intermittently hit `NitroViteError` in this environment |
| Switch E2E job type to `agent.run` | Keep creating `ai.generate_text` jobs | Only `agent.run` reliably feeds traces needed for `/traces` assertion |
| Patch queue payload with user context | Change traces API filtering logic | Preserves per-user trace isolation while fixing missing trace visibility |
| Use resilient role/label-based selectors with retries | Keep strict single-path selectors | Login and dynamic UI behavior had intermittent hydration/toggle timing issues |

## Pending Work

## Immediate Next Steps

1. Update `playwright.config.ts` local strategy to avoid flaky Playwright-managed server spawn (prefer explicit reuse/manual dev server).
2. Add a second E2E test focused only on `/traces` visualization (using pre-created `agent.run` job) to isolate failures faster.
3. Optional: remove duplicated Sign Up controls in login UI or add explicit `data-testid` hooks to simplify E2E.

## Blockers/Open Questions

- [ ] Playwright-managed `webServer` startup still intermittently fails with `NitroViteError` on this machine.
- [ ] Vite occasionally logs `504 Outdated Optimize Dep`; not fully root-caused, but mitigated by clean restart/warm server.

## Deferred Items

- Full diagnosis of Nitro startup race under Playwright was deferred once reliable reuse/manual flow and passing E2E were achieved.
- Docker service lifecycle hardening was deferred; user already scaled Dokploy services down for test runs.

## Context for Resuming Agent

## Important Context

The most important functional bug fixed here is in `src/lib/queue/index.ts`: `agent.run` jobs now carry `userId`/`user_id` into Python payloads. Without this, traces are created but hidden from `/traces` because `TraceTerminal` fetches traces with current session `userId`.  
  
After this fix plus E2E selector updates, the test `e2e/traces.spec.ts` passed:
- Command used: `npx playwright test e2e/traces.spec.ts --project=chromium --workers=1 --reporter=line`
- Result: `1 passed`  
  
Local infra context:
- Dokploy was auto-restarting because it ran as Swarm services, not regular containers.
- User scaled services down; this removed the main port interception issue during testing.

## Assumptions Made

- `python-workers/.venv` remains the correct Python runtime and includes required `pydantic_ai`.
- Test user signup is allowed and not blocked by auth settings.
- `agent.run` jobs can complete with existing local environment and worker wiring.

## Potential Gotchas

- The repo is very dirty; do not revert unrelated changes.
- `e2e/traces.spec.ts` is currently untracked in git in this workspace state.
- If traces disappear again, first verify payload user context (`userId`/`user_id`) and `/api/traces?userId=...` behavior.
- If Playwright fails early with Nitro errors, retry with manually started `npm run dev` and `reuseExistingServer`.

## Restart-Proof Runbook

Follow this sequence exactly after restarting session.

1. Preflight: verify Dokploy services are not running.
   - `docker service ls`
   - If present and active: `docker service scale dokploy=0 dokploy-postgres=0 dokploy-redis=0`
2. Preflight: verify test port is clean.
   - `netstat -ano | findstr :3341`
   - If a Node dev process is listening and stale, stop it.
3. Start app server manually (recommended path).
   - `npm run dev`
   - Expected: `Local: http://127.0.0.1:3341/`
4. Smoke-check critical endpoints before Playwright.
   - `Invoke-WebRequest http://127.0.0.1:3341/login -UseBasicParsing`
   - `Invoke-WebRequest http://127.0.0.1:3341/@id/virtual:tanstack-start-client-entry -UseBasicParsing`
   - Both should return status `200`.
5. Run the test.
   - `npx playwright test e2e/traces.spec.ts --project=chromium --workers=1 --reporter=line`
   - Expected final line: `1 passed`.

## Failure Signatures and Fast Fixes

1. Signature: browser shows Dokploy `400 Oops` page.
   - Cause: Swarm service still intercepting local traffic.
   - Fix: scale Dokploy services to zero (`docker service scale ...=0`) and rerun.
2. Signature: Playwright webServer timeout + `NitroViteError: Vite environment "nitro" is unavailable`.
   - Cause: flaky Playwright-managed server spawn path.
   - Fix: start `npm run dev` manually, then run Playwright against existing server.
3. Signature: `504 Outdated Optimize Dep` and dynamic import fetch failures.
   - Cause: stale Vite optimized deps.
   - Fix: stop dev process, delete `node_modules/.vite`, restart `npm run dev`.
4. Signature: `/traces` says `No traces yet` after job completion.
   - Cause: `agent.run` payload missing `userId`/`user_id`, so user-filtered list hides traces.
   - Fix: ensure `src/lib/queue/index.ts` includes payload injection block for `opts.type === "agent.run"`.
5. Signature: login step fails to show signup name field.
   - Cause: toggle/hydration race and duplicate `Sign Up` controls.
   - Fix: current `e2e/traces.spec.ts` has retry + fallback + `/login` reload path; do not remove.

## Code Checks Before Running Tests

1. Verify queue user-context fix exists.
   - `rg --line-number "opts.type === \"agent.run\"" src/lib/queue/index.ts`
   - Expect assignment of both `payloadWithUser.userId` and `payloadWithUser.user_id`.
2. Verify E2E uses AI Agent flow.
   - `rg --line-number "Start AI Agent|AI Agent|Recent Traces" e2e/traces.spec.ts`
3. Verify Python environment has pydantic-ai.
   - `./python-workers/.venv/Scripts/python.exe -c "import pydantic_ai; print('ok')"`

## Known Good End-to-End Trace Path

1. `/login`:
   - Switch to signup mode (retry/fallback in test).
2. `/jobs`:
   - Choose template `AI Agent`.
   - Submit with prompt.
3. Job lifecycle:
   - Wait for job to leave `Pending/Running`.
4. `/traces`:
   - Wait for sidebar `Recent Traces`.
   - Ensure `No traces yet` is gone.
   - Select first trace row.
   - Assert at least one visible span label (`Agent Run|Tool Call|Model Response|Reasoning|Agent Delegation`).

## What Not To Regress

1. Do not remove user context injection for `agent.run` payloads in `src/lib/queue/index.ts`.
2. Do not revert `e2e/traces.spec.ts` to text-generation flow if the goal is trace verification.
3. Do not rely on Playwright-managed `webServer` startup on this machine without re-validation.
4. Do not run Python outside `python-workers/.venv` for worker-related checks.

## Environment State

### Tools/Services Used

- Node/Vite dev server on `127.0.0.1:3341`
- Playwright (`@playwright/test`) for E2E
- Python workers via `python-workers/.venv/Scripts/python.exe`
- Docker Desktop with Swarm services (Dokploy-related services scaled down by user)

### Active Processes

- No intentional long-running process left by this session; dev server used for test run was stopped afterwards.
- There may be transient TCP `TIME_WAIT` entries on `3341`; these are expected and not active listeners.

### Environment Variables

- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `REDIS_URL`
- `PYTHON_PATH`
- `MAX_PYTHON_WORKERS`
- `OPENROUTER_API_KEY`

## Related Resources

- `.problems/testing_infra_issues.md`
- `.sessions/2026-02-18-deep-tracing-implementation.md`
- `.plans/2026-02-19-nested-traces-multi-agent.md`
- `.handoffs/2026-02-19-144641-e2e-tracing-failure.md`
- `.claude/handoffs/2026-02-19-183834-e2e-tracing-recovery.md`
- `test-results/.last-run.json`

---

**Security Reminder**: Before finalizing, run `validate_handoff.py` to check for accidental secret exposure.
