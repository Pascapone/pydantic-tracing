import type { QueueStats } from "@/lib/hooks/use-jobs";
import { Clock, Play, CheckCircle, XCircle, Pause, Activity } from "lucide-react";

interface JobStatsProps {
  stats: QueueStats | null;
  loading?: boolean;
}

export function JobStats({ stats, loading }: JobStatsProps) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
        ))}
      </div>
    );
  }

  const statItems = [
    { label: "Waiting", value: stats.waiting, icon: <Clock size={18} />, color: "amber" },
    { label: "Active", value: stats.active, icon: <Play size={18} />, color: "blue" },
    { label: "Completed", value: stats.completed, icon: <CheckCircle size={18} />, color: "green" },
    { label: "Failed", value: stats.failed, icon: <XCircle size={18} />, color: "red" },
    { label: "Delayed", value: stats.delayed, icon: <Activity size={18} />, color: "purple" },
    { label: "Paused", value: stats.paused, icon: <Pause size={18} />, color: "gray" },
  ];

  const colorClasses: Record<string, string> = {
    amber: "bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400",
    blue: "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-400",
    green: "bg-green-50 border-green-200 text-green-600 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-400",
    red: "bg-red-50 border-red-200 text-red-600 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-400",
    purple: "bg-purple-50 border-purple-200 text-purple-600 dark:bg-purple-500/10 dark:border-purple-500/30 dark:text-purple-400",
    gray: "bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-500/10 dark:border-gray-500/30 dark:text-gray-400",
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      {statItems.map((item) => (
        <div
          key={item.label}
          className={`rounded-xl border p-3 ${colorClasses[item.color]}`}
        >
          <div className="flex items-center gap-2 mb-1">
            {item.icon}
            <span className="text-xs opacity-80">{item.label}</span>
          </div>
          <p className="text-2xl font-bold">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
