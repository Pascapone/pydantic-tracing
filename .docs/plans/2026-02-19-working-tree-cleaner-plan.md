# Working Tree Cleaner Plan

Date: 2026-02-19
Scope: Clean and normalize the current dirty repository state without mixing unrelated changes.

## 1. Create a safety checkpoint

1. Create a dedicated branch:
   `git switch -c chore/cleanup-working-tree-2026-02-19`
2. Save a baseline snapshot:
   `git status --short > .docs/problems/cleanup-baseline-status.txt`

## 2. Capture doc/path migration changes intentionally

1. Stage migration-related paths:
   `git add -A .docs .plans .problems`
2. Verify expected moves to:
   - `.docs/handoffs`
   - `.docs/plans`
   - `.docs/problems`

## 3. Resolve legacy deleted folders

Decide one strategy per folder (`.tasks`, `.sessions`, `.walkthroughs`):

1. Keep deleted and commit deletions.
2. Migrate into `.docs/*`.
3. Restore from `HEAD` if deletion was accidental.

## 4. Isolate local tooling artifacts

1. Keep `.agent/`, `.agents/`, `.skill-vault/` out of commits.
2. Hide locally via `.git/info/exclude`.
3. Only add to `.gitignore` if team-level policy requires it.

## 5. Keep tracing feature work separate

Tracing files to isolate in their own commit:

- `python-workers/tracing/processor.py`
- `python-workers/agents/orchestrator.py`
- `python-workers/handlers/agent_trace.py`
- `python-workers/tests/test_nested_reasoning_capture.py`

## 6. Run Python validation outside sandbox

Use outside-sandbox execution for Python tests, because sandbox ACL blocks several `.pyd` files and causes false-negative DLL/import errors.

## 7. Commit in clear sequence

1. Commit A: working-tree cleanup (docs/structure only).
2. Commit B: tracing fix changes.
3. Commit C: session handoff document.

## 8. Final verification

1. Run:
   - `git status`
   - `git diff --name-only --cached`
2. Ensure remaining changes are intentional only.
