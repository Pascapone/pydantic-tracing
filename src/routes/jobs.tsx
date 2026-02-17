import { createFileRoute } from "@tanstack/react-router";
import { authMiddleware } from "@/lib/middleware";
import { useSession } from "@/lib/auth-client";
import { useJobs, useJob, useQueueStats, type Job } from "@/lib/hooks/use-jobs";
import { JobList, JobStatusFilter } from "@/components/jobs/JobList";
import { JobCreateForm } from "@/components/jobs/JobCreateForm";
import { JobDetails } from "@/components/jobs/JobDetails";
import { JobStats } from "@/components/jobs/JobStats";
import { useState, useMemo } from "react";
import { Loader2, Cpu, RefreshCw } from "lucide-react";
import type { JobStatus } from "@/lib/hooks/use-jobs";

export const Route = createFileRoute("/jobs")({
  component: JobsPage,
  server: {
    middleware: [authMiddleware],
  },
});

function JobsPage() {
  const { data: session, isPending } = useSession();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const userId = session?.user?.id;

  const {
    jobs,
    loading: jobsLoading,
    error: jobsError,
    createJob,
    cancelJob,
    retryJob,
    refetch,
  } = useJobs(userId, { pollInterval: 3000 });

  const { job: selectedJob, loading: jobLoading } = useJob(selectedJobId, { pollInterval: 2000 });
  const { stats: queueStats } = useQueueStats({ pollInterval: 5000 });

  const filteredJobs = useMemo(() => {
    if (statusFilter === "all") return jobs;
    return jobs.filter((job) => job.status === statusFilter);
  }, [jobs, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<JobStatus | "all", number> = {
      all: jobs.length,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };
    jobs.forEach((job) => {
      counts[job.status]++;
    });
    return counts;
  }, [jobs]);

  if (isPending) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gradient-to-b dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center transition-colors duration-300">
        <Loader2 size={40} className="animate-spin text-cyan-600 dark:text-cyan-400" />
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  const handleCreateJob = async (input: Parameters<typeof createJob>[0]) => {
    setIsCreating(true);
    try {
      await createJob(input);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancelJob = async (id: string) => {
    setActionLoadingId(id);
    try {
      await cancelJob(id);
      if (selectedJobId === id) {
        setSelectedJobId(null);
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRetryJob = async (id: string) => {
    setActionLoadingId(id);
    try {
      await retryJob(id);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSelectJob = (job: Job) => {
    setSelectedJobId(job.id);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gradient-to-b dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-300">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cpu size={24} className="text-cyan-600 dark:text-cyan-400" />
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Job Queue</h1>
              <p className="text-sm text-slate-500 dark:text-gray-400">
                Manage async Python jobs
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={18} className="text-slate-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Queue Stats */}
        <div className="mb-8">
          <h2 className="text-sm font-medium text-slate-500 dark:text-gray-400 mb-3">Queue Statistics</h2>
          <JobStats stats={queueStats} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Job List */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your Jobs</h2>
              </div>

              <div className="mb-4">
                <JobStatusFilter
                  currentFilter={statusFilter}
                  onFilterChange={setStatusFilter}
                  counts={statusCounts}
                />
              </div>

              {jobsError ? (
                <div className="text-center py-8 text-red-500 dark:text-red-400">
                  Error: {jobsError}
                </div>
              ) : (
                <JobList
                  jobs={filteredJobs}
                  onCancelJob={handleCancelJob}
                  onRetryJob={handleRetryJob}
                  onSelectJob={handleSelectJob}
                  actionLoadingId={actionLoadingId}
                  loading={jobsLoading}
                />
              )}
            </div>
          </div>

          {/* Create Job Form */}
          <div className="lg:col-span-1">
            <JobCreateForm onSubmit={handleCreateJob} isSubmitting={isCreating} />
          </div>
        </div>
      </div>

      {/* Job Details Modal */}
      {selectedJobId && (
        <JobDetails
          job={selectedJob}
          loading={jobLoading}
          onClose={() => setSelectedJobId(null)}
          onRetry={() => handleRetryJob(selectedJobId)}
          onCancel={() => handleCancelJob(selectedJobId)}
          isActionLoading={actionLoadingId === selectedJobId}
        />
      )}
    </div>
  );
}
