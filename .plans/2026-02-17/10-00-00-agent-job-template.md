# Implementation Plan: Add Agent Job Template to Job-View

**Created:** 2026-02-17 10:00:00
**Task:** `.tasks/agent-job-template.md`
**Status:** Ready for Review

## Objective

Add the ability to create `agent.run` jobs directly from the Jobs page by adding a new template to the job creation form.

## Analysis

### Current State
- `JOB_TEMPLATES` in `use-jobs.ts` contains 3 templates: textGeneration, imageGeneration, dataProcessing
- `JobCreateForm.tsx` renders these templates dynamically and uses a `templateIcons` map
- The `agent.run` job type is already supported by the backend (Python handler and API)

### Required Changes

1. **`src/lib/hooks/use-jobs.ts`**
   - Add `agentRun` template to `JOB_TEMPLATES` object
   - Template uses icon "brain" for consistency with AI agent theme

2. **`src/components/jobs/JobCreateForm.tsx`**
   - Import `Brain` icon from lucide-react
   - Add "brain" key to `templateIcons` mapping

### Template Configuration

```typescript
agentRun: {
  type: "agent.run",
  name: "AI Agent",
  description: "Run AI agents with tracing",
  icon: "brain",
  defaultPayload: {
    agent: "research",
    prompt: "",
    model: "openrouter:minimax/minimax-m2.5",
  },
  fields: [
    { key: "agent", label: "Agent Type", type: "select", options: ["research", "coding", "analysis", "orchestrator"] },
    { key: "prompt", label: "Prompt", type: "textarea", required: true, placeholder: "Enter your prompt for the agent..." },
    { key: "model", label: "Model", type: "select", options: ["openrouter:minimax/minimax-m2.5", "openrouter:anthropic/claude-3.5-sonnet", "openrouter:openai/gpt-4o"] },
  ],
},
```

## Implementation Steps

1. [ ] Modify `use-jobs.ts` - Add `agentRun` template after `dataProcessing`
2. [ ] Modify `JobCreateForm.tsx` - Import `Brain` and add to `templateIcons`

## Verification

1. Run `npm run dev`
2. Navigate to `/jobs`
3. Verify "AI Agent" appears as 4th template option
4. Select it and verify fields: Agent Type (select), Prompt (textarea), Model (select)
5. Run `npm run build` to ensure no build errors

## Risk Assessment

- **Low Risk**: Changes are additive only, no existing functionality is modified
- **No Breaking Changes**: The template selector iterates over all templates dynamically
