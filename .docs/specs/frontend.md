# Frontend Components

> React components and hooks for job management UI.

## Components

### JobList

Displays a list of jobs with status, progress, and actions.

```tsx
// src/components/jobs/JobList.tsx

interface JobListProps {
  jobs: Job[];
  onCancelJob: (id: string) => void;
  onRetryJob: (id: string) => void;
  onSelectJob: (job: Job) => void;
  actionLoadingId?: string | null;
  loading?: boolean;
}

export function JobList({
  jobs,
  onCancelJob,
  onRetryJob,
  onSelectJob,
  actionLoadingId,
  loading,
}: JobListProps);
```

**Features:**
- Sorts jobs by status priority (running > pending > failed > completed)
- Shows progress bars for running jobs
- Cancel/retry buttons
- Click to view details

**Job Card:**

```tsx
<JobCard
  job={job}
  onCancel={() => onCancelJob(job.id)}
  onRetry={() => onRetryJob(job.id)}
  onClick={() => onSelectJob(job)}
  isActionLoading={actionLoadingId === job.id}
/>
```

---

### JobCreateForm

Form for creating new jobs with template selection.

```tsx
// src/components/jobs/JobCreateForm.tsx

interface JobCreateFormProps {
  onSubmit: (input: CreateJobInput) => Promise<void>;
  isSubmitting?: boolean;
}

export function JobCreateForm({ onSubmit, isSubmitting }: JobCreateFormProps);
```

**Features:**
- Three job templates (Text, Image, Data)
- Dynamic form fields based on template
- Validation
- Auto-fills example prompts

**Templates:**

```typescript
const JOB_TEMPLATES = {
  textGeneration: {
    type: "ai.generate_text",
    name: "AI Text Generation",
    icon: "sparkles",
    fields: [
      { key: "prompt", type: "textarea", required: true },
      { key: "model", type: "select", options: ["gpt-4", "gpt-3.5-turbo"] },
      { key: "temperature", type: "number", min: 0, max: 2 },
      { key: "maxTokens", type: "number", min: 100, max: 4000 },
    ],
  },
  imageGeneration: {
    type: "ai.generate_image",
    name: "AI Image Generation",
    icon: "image",
    fields: [...],
  },
  dataProcessing: {
    type: "data.process",
    name: "Data Processing",
    icon: "data",
    fields: [...],
  },
};
```

---

### JobDetails

Modal showing job details, results, and logs.

```tsx
// src/components/jobs/JobDetails.tsx

interface JobDetailsProps {
  job: JobWithLogs | null;
  loading?: boolean;
  onClose: () => void;
  onRetry?: () => void;
  onCancel?: () => void;
  isActionLoading?: boolean;
}

export function JobDetails({
  job,
  loading,
  onClose,
  onRetry,
  onCancel,
  isActionLoading,
}: JobDetailsProps);
```

**Features:**
- Three tabs: Result, Logs, Payload
- Progress bar for running jobs
- Copy to clipboard for results
- Image preview for image jobs
- Token usage display for text jobs

**Tabs:**

```tsx
type Tab = "result" | "logs" | "payload";
```

---

### JobStats

Queue statistics display.

```tsx
// src/components/jobs/JobStats.tsx

interface JobStatsProps {
  stats: QueueStats | null;
  loading?: boolean;
}

export function JobStats({ stats, loading }: JobStatsProps);
```

**Displays:**
- Waiting (pending)
- Active (running)
- Completed
- Failed
- Delayed
- Paused (cancelled)

---

### JobStatusFilter

Filter buttons for job list.

```tsx
// src/components/jobs/JobList.tsx

interface JobStatusFilterProps {
  currentFilter: JobStatus | "all";
  onFilterChange: (filter: JobStatus | "all") => void;
  counts: Record<JobStatus | "all", number>;
}

export function JobStatusFilter({
  currentFilter,
  onFilterChange,
  counts,
}: JobStatusFilterProps);
```

---

## Hooks

### useJobs

List and manage jobs with auto-polling.

```typescript
// src/lib/hooks/use-jobs.ts

interface UseJobsReturn {
  jobs: Job[];
  loading: boolean;
  error: string | null;
  createJob: (input: CreateJobInput) => Promise<string>;
  cancelJob: (id: string) => Promise<void>;
  retryJob: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

function useJobs(
  userId: string | undefined,
  options?: { pollInterval?: number }
): UseJobsReturn;
```

**Usage:**

```tsx
const {
  jobs,
  loading,
  error,
  createJob,
  cancelJob,
  retryJob,
  refetch,
} = useJobs(userId, { pollInterval: 3000 });
```

---

### useJob

Single job details with auto-polling.

```typescript
interface UseJobReturn {
  job: JobWithLogs | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function useJob(
  jobId: string | null,
  options?: { pollInterval?: number }
): UseJobReturn;
```

**Usage:**

```tsx
const { job, loading, error } = useJob(selectedJobId, { pollInterval: 2000 });
```

---

### useQueueStats

Queue statistics with auto-polling.

```typescript
interface UseQueueStatsReturn {
  stats: QueueStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function useQueueStats(
  options?: { pollInterval?: number }
): UseQueueStatsReturn;
```

**Usage:**

```tsx
const { stats } = useQueueStats({ pollInterval: 5000 });
```

---

## Types

### Job

```typescript
type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

interface Job {
  id: string;
  type: string;
  status: JobStatus;
  priority: number;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  progress: number;
  progressMessage: string | null;
  attempts: number;
  maxAttempts: number;
  userId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### JobWithLogs

```typescript
interface JobLog {
  id: string;
  jobId: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface JobWithLogs extends Job {
  logs: JobLog[];
}
```

### CreateJobInput

```typescript
interface CreateJobInput {
  type: string;
  payload: Record<string, unknown>;
  options?: {
    priority?: number;
    delay?: number;
    attempts?: number;
  };
}
```

### QueueStats

```typescript
interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}
```

---

## Jobs Page

Main page component combining all components.

```tsx
// src/routes/jobs.tsx

function JobsPage() {
  const { data: session } = useSession();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");

  const {
    jobs,
    loading,
    error,
    createJob,
    cancelJob,
    retryJob,
    refetch,
  } = useJobs(session?.user?.id);

  const { job: selectedJob } = useJob(selectedJobId);
  const { stats: queueStats } = useQueueStats();

  return (
    <div>
      <JobStats stats={queueStats} />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <JobStatusFilter
            currentFilter={statusFilter}
            onFilterChange={setStatusFilter}
            counts={statusCounts}
          />
          <JobList
            jobs={filteredJobs}
            onCancelJob={cancelJob}
            onRetryJob={retryJob}
            onSelectJob={(job) => setSelectedJobId(job.id)}
          />
        </div>
        
        <div className="lg:col-span-1">
          <JobCreateForm onSubmit={createJob} />
        </div>
      </div>

      {selectedJobId && (
        <JobDetails
          job={selectedJob}
          onClose={() => setSelectedJobId(null)}
          onRetry={() => retryJob(selectedJobId)}
          onCancel={() => cancelJob(selectedJobId)}
        />
      )}
    </div>
  );
}
```

---

## Styling

Uses Tailwind CSS with dark mode support.

### Status Colors

```typescript
const statusConfig = {
  pending: {
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  running: {
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  completed: {
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
  failed: {
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
  cancelled: {
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
  },
};
```

### Dark Mode

All components support dark mode via Tailwind's `dark:` prefix.

```tsx
<div className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
```
