import { useRef, useEffect, useMemo, useState } from 'react';
import type { TraceTimelineProps, Span } from '@/types/tracing';
import { SpanNode } from './SpanNode';
import { RefreshCw, GitBranch } from 'lucide-react';
import { processSpanTree } from './traceTree';

/**
 * Flatten tree for stats and timestamp computations.
 */
const flattenSpans = (spans: Span[]): Span[] => {
  return spans.flatMap((span) => [span, ...(span.children ? flattenSpans(span.children) : [])]);
};

/**
 * Empty state when no trace is selected
 */
const EmptyState = () => (
  <div className="flex-1 flex items-center justify-center">
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
        <GitBranch size={24} className="text-slate-400 dark:text-slate-500" />
      </div>
      <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
        No Trace Selected
      </h3>
      <p className="text-slate-500 dark:text-slate-400 max-w-sm">
        Select a trace from the sidebar or start a new agent run to see the execution flow.
      </p>
    </div>
  </div>
);

/**
 * Streaming indicator at the bottom of timeline
 */
const StreamingIndicator = () => (
  <div className="relative pl-16 mb-8">
    <div className="absolute left-3 top-0 w-6 h-6 rounded-full bg-primary/20 border-2 border-primary z-10 flex items-center justify-center animate-pulse">
      <div className="w-2 h-2 rounded-full bg-primary" />
    </div>
    <div className="bg-surface-dark border border-primary/30 rounded-sm p-4 flex items-center gap-3">
      <RefreshCw size={16} className="text-primary animate-spin" />
      <span className="text-sm text-primary">Executing...</span>
    </div>
  </div>
);

/**
 * TraceTimeline Component
 * 
 * Center panel showing the visual timeline of agent execution.
 * Displays spans as nodes connected by a vertical line with
 * relative timestamps and status indicators.
 */
export function TraceTimeline({
  trace,
  isStreaming,
  onExpandAll,
  onRerun,
}: TraceTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandAll, setExpandAll] = useState(false);
  const [expandSignal, setExpandSignal] = useState(0);
  
  // Build span tree - MUST be called before any early return (React Hooks rules)
  const spanTree = useMemo(() => {
    if (!trace?.spans) return [];
    return processSpanTree(trace.spans);
  }, [trace?.spans]);
  
  const allSpans = useMemo(() => {
    return flattenSpans(spanTree);
  }, [spanTree]);
  
  const startTime = useMemo(() => {
    if (allSpans.length === 0) return 0;
    return Math.min(...allSpans.map(s => s.startTime));
  }, [allSpans]);
  
  const stats = useMemo(() => ({
    completed: allSpans.filter(s => s.status === 'OK').length,
    error: allSpans.filter(s => s.status === 'ERROR').length,
    active: allSpans.filter(s => s.status === 'UNSET').length,
  }), [allSpans]);
  
  // Auto-scroll to bottom when streaming
  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isStreaming, trace?.spans?.length]);
  
  // Handle empty/loading states - AFTER all hooks
  if (!trace) {
    return (
      <section className="flex-1 flex flex-col bg-slate-50 dark:bg-[#0c1214] relative overflow-hidden">
        <div className="h-14 px-6 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#1a262b]/80 backdrop-blur-sm flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide flex items-center gap-2">
            <GitBranch size={18} className="text-primary" />
            Execution Flow
          </h2>
        </div>
        <EmptyState />
      </section>
    );
  }
  
  const handleExpandAll = () => {
    const nextValue = !expandAll;
    setExpandAll(nextValue);
    setExpandSignal((prev) => prev + 1);
    onExpandAll();
  };
  
  return (
    <section className="flex-1 flex flex-col bg-slate-50 dark:bg-[#0c1214] relative overflow-hidden">
      {/* Header */}
      <div className="h-14 px-6 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#1a262b]/80 backdrop-blur-sm flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-bold uppercase tracking-wide flex items-center gap-2">
            <GitBranch size={18} className="text-primary" />
            Active Execution Flow
          </h2>
          
          {/* Status badges */}
          <div className="flex items-center gap-2">
            {stats.active > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold bg-primary/20 text-primary rounded uppercase">
                {stats.active} Active
              </span>
            )}
            {stats.completed > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold bg-[#0bda57]/20 text-[#0bda57] rounded uppercase">
                {stats.completed} Done
              </span>
            )}
            {stats.error > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold bg-[#ff6b00]/20 text-[#ff6b00] rounded uppercase">
                {stats.error} Errors
              </span>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleExpandAll}
            className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-primary border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded-sm transition-all"
          >
            {expandAll ? 'Collapse All' : 'Expand All'}
          </button>
          <button
            onClick={onRerun}
            className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-primary hover:bg-primary/90 text-white rounded-sm shadow-sm transition-all flex items-center gap-1"
          >
            <RefreshCw size={14} />
            Re-run
          </button>
        </div>
      </div>
      
      {/* Timeline Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto relative">
          {/* Vertical Line */}
          <div className="absolute left-6 top-4 bottom-0 w-0.5 bg-slate-300 dark:bg-slate-700" />
          
          {/* Span Nodes */}
          {spanTree.map(span => (
            <SpanNode
              key={span.id}
              span={span}
              startTime={startTime}
              forceExpanded={expandSignal > 0 ? expandAll : undefined}
              forceExpandedSignal={expandSignal}
              forceContentExpanded={expandSignal > 0 ? expandAll : undefined}
              forceContentExpandedSignal={expandSignal}
            />
          ))}
          
          {/* Streaming Indicator */}
          {isStreaming && <StreamingIndicator />}
        </div>
      </div>
      
      {/* Footer with total duration */}
      {trace.totalDurationMs > 0 && (
        <div className="h-10 px-6 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#1a262b]/80 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Total Duration
          </span>
          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
            {trace.totalDurationMs.toFixed(1)}ms
          </span>
        </div>
      )}
    </section>
  );
}

export default TraceTimeline;
