/**
 * TraceHeader Component
 * 
 * Top navigation bar (h-16) with logo, title, search, navigation tabs,
 * and action buttons.
 */

import { Link } from "@tanstack/react-router";
import { Terminal, Search, Bell, User, Wifi, WifiOff } from "lucide-react";

interface TraceHeaderProps {
  activeTab?: "dashboard" | "traces" | "settings";
  onTabChange?: (tab: "dashboard" | "traces" | "settings") => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  /** WebSocket connection status - true = connected, false = disconnected */
  isConnected?: boolean;
}

export function TraceHeader({
  activeTab = "traces",
  onTabChange,
  searchValue = "",
  onSearchChange,
  isConnected = false,
}: TraceHeaderProps) {
  const tabs: Array<{ key: "dashboard" | "traces" | "settings"; label: string; href: string }> = [
    { key: "dashboard", label: "Dashboard", href: "/dashboard" },
    { key: "traces", label: "Traces", href: "/traces" },
    { key: "settings", label: "Settings", href: "/settings" },
  ];

  return (
    <header className="flex-none h-16 border-b border-slate-200 dark:border-slate-800 bg-surface-light dark:bg-surface-dark px-6 flex items-center justify-between z-10">
      <div className="flex items-center gap-6">
        {/* Logo and Title */}
        <Link to="/traces" className="flex items-center gap-3 text-primary hover:opacity-80 transition-opacity">
          <Terminal className="w-7 h-7" strokeWidth={2} />
          <h1 className="text-xl font-bold tracking-tight uppercase">
            Trace Terminal v1.0
          </h1>
        </Link>

        <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 mx-2"></div>

        {/* Global Search */}
        <div className="relative w-64 group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
            <Search size={16} />
          </div>
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="block w-full pl-10 pr-3 py-1.5 bg-slate-100 dark:bg-[#151f24] border border-slate-300 dark:border-slate-700 rounded-sm text-sm placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono text-slate-700 dark:text-slate-100"
            placeholder="Search Trace ID..."
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1">
          {tabs.map(({ key, label, href }) => (
            <Link
              key={key}
              to={href}
              onClick={() => onTabChange?.(key)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === key
                  ? "text-primary bg-primary/10 rounded-sm border border-primary/20 font-bold"
                  : "text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Connection Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-[#151f24] rounded-sm border border-slate-300 dark:border-slate-700">
          <span
            className={`w-2 h-2 rounded-full transition-colors ${
              isConnected
                ? "bg-matrix-green"
                : "bg-warning-orange animate-pulse"
            }`}
          />
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {isConnected ? "Live" : "Polling"}
          </span>
          {isConnected ? (
            <Wifi size={14} className="text-matrix-green" />
          ) : (
            <WifiOff size={14} className="text-warning-orange" />
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button className="flex items-center justify-center h-8 w-8 rounded-sm bg-slate-100 dark:bg-[#151f24] border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-primary hover:border-primary transition-colors">
            <Bell size={16} />
          </button>
          <button className="flex items-center justify-center h-8 w-8 rounded-sm bg-slate-100 dark:bg-[#151f24] border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-primary hover:border-primary transition-colors">
            <User size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
