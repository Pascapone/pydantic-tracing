/**
 * TraceStats Component
 * 
 * Stats grid component showing status, latency, and token budget.
 * Uses a 2x2 grid layout with the token budget spanning 2 columns.
 */

import { Activity } from "lucide-react";

export interface TraceStatsData {
  status: "running" | "idle";
  latency: number;
  latencyChange: number;
  tokenBudget: { used: number; total: number };
}

interface TraceStatsProps {
  stats: TraceStatsData;
}

export function TraceStats({ stats }: TraceStatsProps) {
  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const getLatencyChangeIndicator = () => {
    const isPositive = stats.latencyChange >= 0;
    return (
      <span
        className={`text-[10px] font-mono ${
          isPositive ? "text-matrix-green" : "text-warning-orange"
        }`}
      >
        {isPositive ? "▲" : "▼"}
        {Math.abs(stats.latencyChange)}%
      </span>
    );
  };

  const tokenPercentage = Math.min(
    100,
    (stats.tokenBudget.used / stats.tokenBudget.total) * 100
  );

  return (
    <div className="p-4 grid grid-cols-2 gap-3 border-b border-slate-200 dark:border-slate-800">
      {/* Status Card */}
      <div className="p-3 bg-slate-100 dark:bg-[#151f24] border border-slate-200 dark:border-slate-700 rounded-sm">
        <p className="text-xs font-medium text-slate-500 uppercase mb-1">Status</p>
        <div className="flex items-center gap-2">
          {stats.status === "running" ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-matrix-green opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-matrix-green"></span>
              </span>
              <span className="text-sm font-bold tracking-tight text-slate-100">RUNNING</span>
            </>
          ) : (
            <>
              <Activity className="h-2.5 w-2.5 text-slate-400" />
              <span className="text-sm font-bold tracking-tight text-slate-400">IDLE</span>
            </>
          )}
        </div>
      </div>

      {/* Latency Card */}
      <div className="p-3 bg-slate-100 dark:bg-[#151f24] border border-slate-200 dark:border-slate-700 rounded-sm">
        <p className="text-xs font-medium text-slate-500 uppercase mb-1">Latency</p>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-tight text-slate-100">
            {stats.latency}ms
          </span>
          {getLatencyChangeIndicator()}
        </div>
      </div>

      {/* Token Budget Card */}
      <div className="p-3 bg-slate-100 dark:bg-[#151f24] border border-slate-200 dark:border-slate-700 rounded-sm col-span-2">
        <div className="flex justify-between items-center mb-1">
          <p className="text-xs font-medium text-slate-500 uppercase">Token Budget</p>
          <span className="text-xs font-mono text-slate-400">
            {formatNumber(stats.tokenBudget.used)} / {formatNumber(stats.tokenBudget.total)}
          </span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-primary h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${tokenPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
