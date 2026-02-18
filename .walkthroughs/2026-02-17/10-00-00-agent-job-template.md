# Walkthrough: Add Agent Job Template to Job-View

**Completed:** 2026-02-17 10:00:00
**Task:** `.tasks/agent-job-template.md`
**Plan:** `.plans/2026-02-17/10-00-00-agent-job-template.md`

## Summary

Successfully added the `agent.run` job template to the Jobs page, allowing users to create AI agent jobs directly from the UI.

## Changes Made

### 1. `src/lib/hooks/use-jobs.ts`

Added a new template `agentRun` to the `JOB_TEMPLATES` object:

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

### 2. `src/components/jobs/JobCreateForm.tsx`

1. Added `Brain` to the lucide-react imports
2. Added `brain` icon mapping to `templateIcons`:

```typescript
import { Sparkles, Image, Database, Brain, Loader2, X } from "lucide-react";

const templateIcons: Record<string, React.ReactNode> = {
  sparkles: <Sparkles size={20} />,
  image: <Image size={20} />,
  data: <Database size={20} />,
  brain: <Brain size={20} />,  // NEW
};
```

## How It Works

1. The `JobCreateForm` component iterates over all templates in `JOB_TEMPLATES`
2. When a user selects the "AI Agent" template, the form displays:
   - **Agent Type** dropdown: research, coding, analysis, orchestrator
   - **Prompt** textarea (required)
   - **Model** dropdown: various OpenRouter models
3. On submit, a job of type `agent.run` is created via the API
4. The Python worker picks up the job and executes the appropriate agent

## Integration Points

- **Backend:** `python-workers/handlers/agent_trace.py` handles `agent.run` jobs
- **API:** `src/routes/api/jobs/index.ts` accepts `agent.run` as valid job type
- **Frontend:** The form dynamically renders based on template configuration

## Verification

To verify the implementation:

1. Run `npm run dev`
2. Navigate to `/jobs`
3. Verify "AI Agent" appears as the 4th template option with a brain icon
4. Select it to see the agent configuration fields
5. Submit a job to verify the `agent.run` type is accepted

## Notes

- The template is purely additive - no existing functionality was modified
- The icon system is extensible - just add new icons to `templateIcons` mapping
- Field types supported: `textarea`, `select`, `number` (all handled in the form)
