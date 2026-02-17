import type { JobWithLogs, JobStatus } from "@/lib/hooks/use-jobs";
import {
  X,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Ban,
  AlertCircle,
  Copy,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";

const statusConfig: Record<
  JobStatus,
  { color: string; bgColor: string; borderColor: string; icon: React.ReactNode; label: string }
> = {
  pending: {
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-500/10",
    borderColor: "border-amber-200 dark:border-amber-500/30",
    icon: <Clock size={18} />,
    label: "Pending",
  },
  running: {
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-500/10",
    borderColor: "border-blue-200 dark:border-blue-500/30",
    icon: <Loader2 size={18} className="animate-spin" />,
    label: "Running",
  },
  completed: {
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-500/10",
    borderColor: "border-green-200 dark:border-green-500/30",
    icon: <CheckCircle size={18} />,
    label: "Completed",
  },
  failed: {
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-500/10",
    borderColor: "border-red-200 dark:border-red-500/30",
    icon: <XCircle size={18} />,
    label: "Failed",
  },
  cancelled: {
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-50 dark:bg-gray-500/10",
    borderColor: "border-gray-200 dark:border-gray-500/30",
    icon: <Ban size={18} />,
    label: "Cancelled",
  },
};

const logLevelColors: Record<string, string> = {
  info: "text-blue-600 dark:text-blue-400",
  warn: "text-amber-600 dark:text-amber-400",
  error: "text-red-600 dark:text-red-400",
  debug: "text-gray-500 dark:text-gray-400",
};

interface JobDetailsProps {
  job: JobWithLogs | null;
  loading?: boolean;
  onClose: () => void;
  onRetry?: () => void;
  onCancel?: () => void;
  isActionLoading?: boolean;
}

export function JobDetails({ job, loading, onClose, onRetry, onCancel, isActionLoading }: JobDetailsProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"result" | "logs" | "payload">("result");

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Loader2 size={32} className="animate-spin text-white" />
      </div>
    );
  }

  if (!job) return null;

  const config = statusConfig[job.status];

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString();
  };

  const formatDuration = () => {
    if (!job.startedAt) return "Not started";

    const start = new Date(job.startedAt).getTime();
    const end = job.completedAt ? new Date(job.completedAt).getTime() : Date.now();
    const duration = Math.round((end - start) / 1000);

    if (duration < 60) return `${duration} seconds`;
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    return `${mins}m ${secs}s`;
  };

  const renderResult = () => {
    if (!job.result) {
      return (
        <div className="text-center py-8 text-slate-500 dark:text-gray-400">
          {job.status === "running" ? "Processing..." : "No results yet"}
        </div>
      );
    }

    const result = job.result as Record<string, unknown>;

    // Handle image result
    if (result.image_url) {
      return (
        <div className="space-y-4">
          <div className="rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 aspect-square flex items-center justify-center">
            <img
              src={result.image_url as string}
              alt="Generated"
              className="max-w-full max-h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect fill='%23f1f5f9' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-family='system-ui' font-size='14'%3EImage Preview%3C/text%3E%3C/svg%3E";
              }}
            />
          </div>
          <div className="flex gap-2">
            <a
              href={result.image_url as string}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium text-center transition-colors flex items-center justify-center gap-2"
            >
              <ExternalLink size={14} />
              Open Image
            </a>
            <button
              onClick={() => copyToClipboard(result.image_url as string, "image_url")}
              className="py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-gray-300 text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Copy size={14} />
              Copy URL
            </button>
          </div>
        </div>
      );
    }

    // Handle text result
    if (result.text) {
      return (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-700 dark:text-gray-300 whitespace-pre-wrap">{result.text as string}</p>
          </div>
          <button
            onClick={() => copyToClipboard(result.text as string, "text")}
            className="w-full py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-gray-300 text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {copiedField === "text" ? "Copied!" : <><Copy size={14} /> Copy Text</>}
          </button>
          {Boolean(result.usage) && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900">
                <p className="text-xs text-slate-500 dark:text-gray-400">Prompt</p>
                <p className="font-medium text-slate-900 dark:text-white">{((result.usage as Record<string, number>)?.prompt_tokens) ?? 0}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900">
                <p className="text-xs text-slate-500 dark:text-gray-400">Completion</p>
                <p className="font-medium text-slate-900 dark:text-white">{((result.usage as Record<string, number>)?.completion_tokens) ?? 0}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900">
                <p className="text-xs text-slate-500 dark:text-gray-400">Total</p>
                <p className="font-medium text-slate-900 dark:text-white">{((result.usage as Record<string, number>)?.total_tokens) ?? 0}</p>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Generic result display
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
          <pre className="text-sm text-slate-700 dark:text-gray-300 whitespace-pre-wrap overflow-auto max-h-96">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
        <button
          onClick={() => copyToClipboard(JSON.stringify(result, null, 2), "json")}
          className="w-full py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-gray-300 text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          {copiedField === "json" ? "Copied!" : <><Copy size={14} /> Copy JSON</>}
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`p-4 border-b ${config.borderColor} ${config.bgColor}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className={config.color}>{config.icon}</span>
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white">Job Details</h2>
                <p className="text-sm text-slate-500 dark:text-gray-400">{job.type}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/50 dark:hover:bg-slate-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Progress bar for running jobs */}
          {job.status === "running" && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className={config.color}>{job.progressMessage || "Processing..."}</span>
                <span className="text-slate-600 dark:text-gray-400">{job.progress}%</span>
              </div>
              <div className="h-2 bg-white/50 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Meta info */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-500 dark:text-gray-400">Created</p>
            <p className="text-slate-900 dark:text-white font-medium">{formatDate(job.createdAt)}</p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-gray-400">Duration</p>
            <p className="text-slate-900 dark:text-white font-medium">{formatDuration()}</p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-gray-400">Attempts</p>
            <p className="text-slate-900 dark:text-white font-medium">{job.attempts} / {job.maxAttempts}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 dark:border-slate-700">
          <div className="flex gap-1 px-4">
            {(["result", "logs", "payload"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-cyan-500 text-cyan-600 dark:text-cyan-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === "logs" && job.logs && (
                  <span className="ml-1 opacity-70">({job.logs.length})</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === "result" && (
            <>
              {job.error ? (
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={18} className="text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-red-800 dark:text-red-300 mb-1">Error</h3>
                      <p className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">{job.error}</p>
                    </div>
                  </div>
                </div>
              ) : (
                renderResult()
              )}
            </>
          )}

          {activeTab === "logs" && (
            <div className="space-y-2">
              {job.logs.length === 0 ? (
                <p className="text-center py-8 text-slate-500 dark:text-gray-400">No logs yet</p>
              ) : (
                job.logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900 text-sm"
                  >
                    <span className={`font-mono ${logLevelColors[log.level]}`}>[{log.level.toUpperCase()}]</span>
                    <span className="text-slate-700 dark:text-gray-300">{log.message}</span>
                    <span className="text-slate-400 dark:text-gray-500 ml-auto text-xs">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "payload" && (
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <pre className="text-sm text-slate-700 dark:text-gray-300 whitespace-pre-wrap overflow-auto">
                {JSON.stringify(job.payload, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-2">
          {job.status === "failed" && onRetry && (
            <button
              onClick={onRetry}
              disabled={isActionLoading}
              className="flex-1 py-2 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isActionLoading ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
              Retry Job
            </button>
          )}
          {(job.status === "pending" || job.status === "running") && onCancel && (
            <button
              onClick={onCancel}
              disabled={isActionLoading}
              className="flex-1 py-2 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isActionLoading ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
              Cancel Job
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-gray-300 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
