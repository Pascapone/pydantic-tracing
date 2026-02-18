/**
 * TraceSidebar Component
 * 
 * Left panel (w-80) containing stats grid and trace list.
 * Includes scrollable trace list with selection support.
 */

import { Clock, Coins } from "lucide-react";
import { TraceStats } from "./TraceStats";
import type { TraceStatsData } from "./TraceStats";

// Re-export TraceStatsData for convenience
export type { TraceStatsData } from "./TraceStats";

export interface TraceSummary {
  id: string;
  name: string;
  status: "active" | "done" | "error";
  preview: string;
  timestamp: Date;
  tokens: number;
}

interface TraceSidebarProps {
  traces: TraceSummary[];
  selectedId?: string;
  stats: TraceStatsData;
  onSelect: (id: string) => void;
  isLoading?: boolean;
}

const statusConfig = {
  active: {
    badge: "bg-matrix-green/20 text-matrix-green",
    label: "Active",
    textClass: "text-primary",
  },
  done: {
    badge: "bg-slate-200 dark:bg-slate-700 text-slate-500",
    label: "Done",
    textClass: "text-slate-700 dark:text-slate-300",
  },
  error: {
    badge: "bg-warning-orange/20 text-warning-orange",
    label: "Error",
    textClass: "text-warning-orange",
  },
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

export function TraceSidebar({
  traces,
  selectedId,
  stats,
  onSelect,
  isLoading,
}: TraceSidebarProps) {
  return (
    <aside className="w-80 flex-none border-r border-slate-200 dark:border-slate-800 bg-surface-light dark:bg-surface-dark flex flex-col">
      {/* Stats Grid */}
      <TraceStats stats={stats} />

      {/* Trace Selector List */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider sticky top-0 bg-surface-light dark:bg-surface-dark z-10 border-b border-slate-200 dark:border-slate-800">
          Recent Traces
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : traces.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <p className="text-sm">No traces yet</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {traces.map((trace) => {
              const config = statusConfig[trace.status];
              const isSelected = trace.id === selectedId;

              return (
                <button
                  key={trace.id}
                  onClick={() => onSelect(trace.id)}
                  className={`text-left p-4 border-b border-slate-200 dark:border-slate-800 transition-colors group ${
                    isSelected
                      ? "bg-primary/10 border-l-4 border-l-primary hover:bg-primary/20"
                      : "hover:bg-slate-100 dark:hover:bg-[#151f24] border-l-4 border-l-transparent"
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span
                      className={`text-sm font-bold font-mono ${
                        isSelected ? "text-primary" : config.textClass
                      } group-hover:text-primary`}
                    >
                      {trace.name}
                    </span>
                    <span
                      className={`text-[10px] ${config.badge} px-1.5 py-0.5 rounded uppercase font-bold`}
                    >
                      {config.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mb-2">
                    {trace.preview}
                  </p>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {formatTimeAgo(trace.timestamp)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Coins size={12} />
                      {formatTokens(trace.tokens)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
