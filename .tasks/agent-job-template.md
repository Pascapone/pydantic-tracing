# Task: Add Agent Job Template to Job-View

**Priority:** High
**Estimate:** 30 minutes
**Dependencies:** None

## Objective

Add the ability to create `agent.run` jobs directly from the Jobs page. Users should be able to select an agent type (research, coding, analysis, orchestrator) and enter a prompt to start an agent job.

## Context

- The `agent.run` job type already exists in the Python handler (`python-workers/handlers/agent_trace.py`)
- The Jobs API already accepts `agent.run` as a valid job type (`src/routes/api/jobs/index.ts`)
- We need to add UI support in the frontend

## Files to Modify

### 1. `src/lib/hooks/use-jobs.ts`

Add a new template to `JOB_TEMPLATES`:

```typescript
agentRun: {
  type: "agent.run",
  name: "AI Agent",
  description: "Run AI agents with tracing",
  icon: "brain",  // or "agent" - use appropriate lucide icon
  defaultPayload: {
    agent: "research",
    prompt: "",
    model: "openrouter:minimax/minimax-m2.5",
  },
  fields: [
    { 
      key: "agent", 
      label: "Agent Type", 
      type: "select", 
      options: ["research", "coding", "analysis", "orchestrator"] 
    },
    { 
      key: "prompt", 
      label: "Prompt", 
      type: "textarea", 
      required: true, 
      placeholder: "Enter your prompt for the agent..." 
    },
    { 
      key: "model", 
      label: "Model", 
      type: "select", 
      options: [
        "openrouter:minimax/minimax-m2.5", 
        "openrouter:anthropic/claude-3.5-sonnet",
        "openrouter:openai/gpt-4o"
      ] 
    },
  ],
},
```

### 2. `src/components/jobs/JobCreateForm.tsx`

1. Import a suitable icon from lucide-react (e.g., `Brain`, `Bot`, or `Cpu`)
2. Add the icon to `templateIcons`:

```typescript
const templateIcons: Record<string, React.ReactNode> = {
  sparkles: <Sparkles size={20} />,
  image: <Image size={20} />,
  data: <Database size={20} />,
  brain: <Brain size={20} />,  // NEW
};
```

The template selector will automatically show the new agent option because it iterates over all templates.

## Verification

1. Run `npm run dev`
2. Navigate to `/jobs`
3. Verify that "AI Agent" appears as the 4th template option
4. Select it, enter a prompt
5. Click "Start AI Agent"
6. Verify job is created with type `agent.run`
7. Check that the job runs and creates a trace

## Notes

- The `agent.run` payload structure is documented in `.specs/trace-integration.md`
- The Python handler expects: `agent`, `prompt`, `model`, `userId`, `sessionId`, `options`
