import type { Job, JobStatus } from "@/lib/hooks/use-jobs";
import {
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Ban,
  Play,
  RotateCcw,
  Trash2,
  ChevronRight,
} from "lucide-react";

const statusConfig: Record<
  JobStatus,
  { color: string; bgColor: string; borderColor: string; icon: React.ReactNode; label: string }
> = {
  pending: {
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-500/10",
    borderColor: "border-amber-200 dark:border-amber-500/30",
    icon: <Clock size={16} />,
    label: "Pending",
  },
  running: {
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-500/10",
    borderColor: "border-blue-200 dark:border-blue-500/30",
    icon: <Loader2 size={16} className="animate-spin" />,
    label: "Running",
  },
  completed: {
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-500/10",
    borderColor: "border-green-200 dark:border-green-500/30",
    icon: <CheckCircle size={16} />,
    label: "Completed",
  },
  failed: {
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-500/10",
    borderColor: "border-red-200 dark:border-red-500/30",
    icon: <XCircle size={16} />,
    label: "Failed",
  },
  cancelled: {
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-50 dark:bg-gray-500/10",
    borderColor: "border-gray-200 dark:border-gray-500/30",
    icon: <Ban size={16} />,
    label: "Cancelled",
  },
};

const jobTypeLabels: Record<string, string> = {
  "ai.generate_text": "Text Generation",
  "ai.generate_image": "Image Generation",
  "ai.analyze_data": "Data Analysis",
  "ai.embeddings": "Embeddings",
  "data.process": "Data Processing",
  "data.transform": "Data Transform",
  "data.export": "Data Export",
  custom: "Custom Job",
};

interface JobCardProps {
  job: Job;
  onCancel?: () => void;
  onRetry?: () => void;
  onClick?: () => void;
  isActionLoading?: boolean;
}

export function JobCard({ job, onCancel, onRetry, onClick, isActionLoading }: JobCardProps) {
  const config = statusConfig[job.status];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = () => {
    if (!job.startedAt) return null;

    const start = new Date(job.startedAt).getTime();
    const end = job.completedAt ? new Date(job.completedAt).getTime() : Date.now();
    const duration = Math.round((end - start) / 1000);

    if (duration < 60) return `${duration}s`;
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div
      className={`rounded-xl border ${config.borderColor} ${config.bgColor} p-4 transition-all hover:shadow-md cursor-pointer group`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={config.color}>{config.icon}</span>
          <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
        </div>
        <span className="text-xs text-slate-500 dark:text-gray-400">
          {formatDate(job.createdAt)}
        </span>
      </div>

      <div className="mb-3">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
          {jobTypeLabels[job.type] || job.type}
        </h3>
        <p className="text-sm text-slate-500 dark:text-gray-400 line-clamp-2">
          {job.payload?.prompt
            ? String(job.payload.prompt).slice(0, 100)
            : job.payload?.operation
            ? `${job.payload.operation} operation`
            : "View details..."}
        </p>
      </div>

      {job.status === "running" && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-gray-400 mb-1">
            <span>{job.progressMessage || "Processing..."}</span>
            <span>{job.progress}%</span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-gray-400">
          {formatDuration() && <span>Duration: {formatDuration()}</span>}
          {job.attempts > 0 && <span>Attempt: {job.attempts}/{job.maxAttempts}</span>}
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {job.status === "pending" && onCancel && (
            <button
              onClick={onCancel}
              disabled={isActionLoading}
              className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors"
              title="Cancel"
            >
              {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          )}
          {job.status === "running" && onCancel && (
            <button
              onClick={onCancel}
              disabled={isActionLoading}
              className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors"
              title="Cancel"
            >
              {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
            </button>
          )}
          {job.status === "failed" && onRetry && (
            <button
              onClick={onRetry}
              disabled={isActionLoading}
              className="p-1.5 rounded-lg text-slate-500 hover:text-green-600 hover:bg-green-50 dark:text-gray-400 dark:hover:text-green-400 dark:hover:bg-green-500/10 transition-colors"
              title="Retry"
            >
              {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            </button>
          )}
          <ChevronRight size={16} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-gray-300 transition-colors" />
        </div>
      </div>
    </div>
  );
}

interface JobListProps {
  jobs: Job[];
  onCancelJob: (id: string) => void;
  onRetryJob: (id: string) => void;
  onSelectJob: (job: Job) => void;
  actionLoadingId?: string | null;
  loading?: boolean;
}

export function JobList({ jobs, onCancelJob, onRetryJob, onSelectJob, actionLoadingId, loading }: JobListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={32} className="animate-spin text-cyan-600 dark:text-cyan-400" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
          <Play size={24} className="text-slate-400 dark:text-gray-500" />
        </div>
        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No jobs yet</h3>
        <p className="text-slate-500 dark:text-gray-400">Create your first job to get started</p>
      </div>
    );
  }

  const sortedJobs = [...jobs].sort((a, b) => {
    const statusOrder = { running: 0, pending: 1, failed: 2, completed: 3, cancelled: 4 };
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="space-y-3">
      {sortedJobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          onCancel={() => onCancelJob(job.id)}
          onRetry={() => onRetryJob(job.id)}
          onClick={() => onSelectJob(job)}
          isActionLoading={actionLoadingId === job.id}
        />
      ))}
    </div>
  );
}

interface JobStatusFilterProps {
  currentFilter: JobStatus | "all";
  onFilterChange: (filter: JobStatus | "all") => void;
  counts: Record<JobStatus | "all", number>;
}

export function JobStatusFilter({ currentFilter, onFilterChange, counts }: JobStatusFilterProps) {
  const filters: Array<{ key: JobStatus | "all"; label: string }> = [
    { key: "all", label: "All" },
    { key: "running", label: "Running" },
    { key: "pending", label: "Pending" },
    { key: "completed", label: "Completed" },
    { key: "failed", label: "Failed" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onFilterChange(key)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            currentFilter === key
              ? "bg-cyan-600 text-white dark:bg-cyan-500"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700"
          }`}
        >
          {label}
          <span className="ml-1.5 opacity-70">({counts[key]})</span>
        </button>
      ))}
    </div>
  );
}
