import { useRef, useEffect, useMemo } from 'react';
import type { LogEntry, LogLevel, TraceLogStreamProps, LogLevelConfig } from '@/types/tracing';
import { Pause, Play, Download, ChevronDown } from 'lucide-react';

/**
 * Configuration for log level styling
 */
const logLevelConfigs: Record<LogLevel, LogLevelConfig> = {
  INFO: {
    borderColor: 'border-primary',
    bgColor: 'bg-transparent',
    textColor: 'text-slate-400',
    labelColor: 'text-primary',
  },
  DEBUG: {
    borderColor: 'border-slate-700',
    bgColor: 'bg-transparent opacity-50',
    textColor: 'text-slate-400',
    labelColor: 'text-primary',
  },
  WARN: {
    borderColor: 'border-[#ff6b00]', // warning-orange
    bgColor: 'bg-[#ff6b00]/5',
    textColor: 'text-slate-300',
    labelColor: 'text-[#ff6b00]',
  },
  SUCCESS: {
    borderColor: 'border-[#0bda57]', // matrix-green
    bgColor: 'bg-[#0bda57]/5',
    textColor: 'text-slate-300',
    labelColor: 'text-[#0bda57]',
  },
  ERROR: {
    borderColor: 'border-red-500',
    bgColor: 'bg-red-500/5',
    textColor: 'text-red-400',
    labelColor: 'text-red-500',
  },
};

/**
 * Simple JSON syntax highlighting
 */
const JsonHighlight = ({ content }: { content: Record<string, unknown> }) => {
  const jsonString = JSON.stringify(content, null, 0);
  
  // Parse and highlight JSON
  const highlighted = useMemo(() => {
    const parts: React.ReactNode[] = [];
    let inKey = false;
    let inString = false;
    let currentText = '';
    
    // Simple tokenizer approach
    const tokens = jsonString.split(/([{}[\],:"])/);
    
    tokens.forEach((token, index) => {
      if (token === '"') {
        if (inString) {
          // End of string
          if (inKey) {
            parts.push(
              <span key={index} className="text-purple-400">
                "{currentText}"
              </span>
            );
            inKey = false;
          } else {
            parts.push(
              <span key={index} className="text-green-400">
                "{currentText}"
              </span>
            );
          }
          currentText = '';
          inString = false;
        } else {
          // Start of string - could be key or value
          inString = true;
          // Check if next tokens indicate this is a key (followed by colon)
          const nextNonWhitespace = tokens.slice(index + 1).find(t => t.trim());
          if (nextNonWhitespace === ':') {
            inKey = true;
          }
        }
      } else if (inString) {
        currentText += token;
      } else if (token === ':') {
        parts.push(<span key={index}>: </span>);
      } else if (token === ',') {
        parts.push(<span key={index}>, </span>);
      } else if (token === '{' || token === '[') {
        parts.push(<span key={index}>{token}</span>);
      } else if (token === '}' || token === ']') {
        parts.push(<span key={index}>{token}</span>);
      } else if (token.trim()) {
        // Number, boolean, or null
        if (token === 'true' || token === 'false') {
          parts.push(<span key={index} className="text-yellow-300">{token}</span>);
        } else if (token === 'null') {
          parts.push(<span key={index} className="text-slate-500">{token}</span>);
        } else {
          parts.push(<span key={index} className="text-blue-400">{token}</span>);
        }
      }
    });
    
    return parts;
  }, [jsonString]);
  
  return <>{highlighted}</>;
};

/**
 * Format timestamp for log display
 */
const formatTimestamp = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
};

/**
 * Single log entry component
 */
const LogItem = ({ log }: { log: LogEntry }) => {
  const config = logLevelConfigs[log.level];
  
  return (
    <div className={`text-slate-500 border-l-2 ${config.borderColor} pl-2 ${config.bgColor} p-1 rounded-r-sm`}>
      <div className="flex justify-between mb-1">
        <span className={`text-[10px] ${config.labelColor} font-bold`}>
          {log.level}
        </span>
        <span className="text-[10px] text-slate-500">
          {formatTimestamp(log.timestamp)}
        </span>
      </div>
      <div className={`${config.textColor} break-words text-xs font-mono`}>
        <JsonHighlight content={log.content} />
      </div>
    </div>
  );
};

/**
 * Streaming indicator at bottom of log stream
 */
const StreamingIndicator = () => (
  <div className="pl-2 flex items-center gap-2 text-primary animate-pulse">
    <ChevronDown size={16} />
    <span className="text-[10px] uppercase font-bold">Receiving Stream...</span>
  </div>
);

/**
 * Empty state when no logs
 */
const EmptyLogs = () => (
  <div className="flex-1 flex items-center justify-center text-center p-4">
    <div>
      <p className="text-slate-500 dark:text-slate-400 text-xs">
        No logs yet
      </p>
      <p className="text-slate-600 dark:text-slate-500 text-[10px] mt-1">
        Logs will appear here as the agent executes
      </p>
    </div>
  </div>
);

/**
 * TraceLogStream Component
 * 
 * Right panel showing raw JSON log stream with:
 * - Color-coded log levels
 * - JSON syntax highlighting
 * - Auto-scroll (when not paused)
 * - Pause/Download controls
 * - Streaming indicator
 */
export function TraceLogStream({
  logs,
  isPaused,
  isStreaming,
  onPauseToggle,
  onDownload,
}: TraceLogStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  
  // Handle scroll to detect if user scrolled up
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    shouldAutoScroll.current = isAtBottom;
  };
  
  // Auto-scroll to bottom when new logs arrive (if not paused and at bottom)
  useEffect(() => {
    if (!isPaused && shouldAutoScroll.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isPaused]);
  
  // Handle download
  const handleDownload = () => {
    const logText = logs
      .map(log => `[${log.level}] ${formatTimestamp(log.timestamp)} ${JSON.stringify(log.content)}`)
      .join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trace-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    onDownload();
  };
  
  return (
    <aside className="w-96 flex-none border-l border-slate-200 dark:border-slate-800 bg-[#0e1116] flex flex-col font-mono text-xs">
      {/* Header */}
      <div className="h-10 px-4 border-b border-slate-800 flex items-center justify-between bg-[#151f24]">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Raw Log Stream
        </span>
        <div className="flex gap-2">
          <button
            onClick={onPauseToggle}
            className={`transition-colors ${
              isPaused 
                ? 'text-primary hover:text-primary/80' 
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button
            onClick={handleDownload}
            className="text-slate-500 hover:text-slate-300 transition-colors"
            title="Download logs"
            disabled={logs.length === 0}
          >
            <Download size={16} />
          </button>
        </div>
      </div>
      
      {/* Log Items */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide"
      >
        {logs.length === 0 ? (
          <EmptyLogs />
        ) : (
          <>
            {logs.map(log => (
              <LogItem key={log.id} log={log} />
            ))}
            
            {/* Streaming indicator */}
            {isStreaming && !isPaused && <StreamingIndicator />}
          </>
        )}
      </div>
      
      {/* Footer with log count */}
      {logs.length > 0 && (
        <div className="h-8 px-4 border-t border-slate-800 bg-[#151f24] flex items-center justify-between text-[10px] text-slate-500">
          <span>{logs.length} logs</span>
          {isPaused && (
            <span className="text-primary animate-pulse">PAUSED</span>
          )}
        </div>
      )}
    </aside>
  );
}

export default TraceLogStream;
