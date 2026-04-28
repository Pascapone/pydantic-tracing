import { useEffect, useState } from 'react';
import type { Span, SpanType, SpanStatus, SpanNodeProps, SpanTypeConfig } from '@/types/tracing';
import { JsonRenderer } from './JsonRenderer';
import {
  Brain,
  Bolt,
  Bot,
  ArrowDownToLine,
  GitBranch,
  User,
  Check,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  MessageSquare,
  Eye,
  EyeOff,
} from 'lucide-react';



/**
 * Configuration for each span type - icon, colors, and labels
 */
const spanTypeConfigs: Record<SpanType, SpanTypeConfig> = {
  'agent.run': {
    icon: 'psychology',
    color: 'text-primary',
    bgColor: 'bg-primary/20',
    borderColor: 'border-primary',
    label: 'Agent Run',
  },
  'tool.call': {
    icon: 'bolt',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500',
    label: 'Tool Call',
  },
  'tool.result': {
    icon: 'output',
    color: 'text-green-500',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500',
    label: 'Tool Result',
  },
  'model.request': {
    icon: 'smart_toy',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500',
    label: 'Model Request',
  },
  'model.response': {
    icon: 'output',
    color: 'text-[#0bda57]', // matrix-green
    bgColor: 'bg-[#0bda57]/20',
    borderColor: 'border-[#0bda57]',
    label: 'Model Response',
  },
  'model.reasoning': {
    icon: 'lightbulb',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500',
    label: 'Reasoning',
  },
  'agent.delegation': {
    icon: 'hub',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500',
    label: 'Agent Delegation',
  },
  'user.prompt': {
    icon: 'person',
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500',
    label: 'User Prompt',
  },
  'user_input': {
    icon: 'person',
    color: 'text-slate-500',
    bgColor: 'bg-slate-200 dark:bg-slate-800',
    borderColor: 'border-slate-400 dark:border-slate-600',
    label: 'User Input',
  },
};

const NESTING_INDENT_PX = 12;

const getMaxDescendantDepth = (span: Span): number => {
  if (!span.children || span.children.length === 0) {
    return 0;
  }

  return 1 + Math.max(...span.children.map(getMaxDescendantDepth));
};

/**
 * Map span type to Lucide icon component
 */
const SpanIcon = ({ type, className }: { type: SpanType; className?: string }) => {
  const iconProps = { size: 14, className };

  switch (type) {
    case 'agent.run':
      return <Brain {...iconProps} />;
    case 'tool.call':
      return <Bolt {...iconProps} />;
    case 'tool.result':
      return <ArrowDownToLine {...iconProps} />;
    case 'model.request':
      return <Bot {...iconProps} />;
    case 'model.response':
      return <ArrowDownToLine {...iconProps} />;
    case 'model.reasoning':
      return <Lightbulb {...iconProps} />;
    case 'agent.delegation':
      return <GitBranch {...iconProps} />;
    case 'user.prompt':
      return <MessageSquare {...iconProps} />;
    case 'user_input':
      return <User {...iconProps} />;
    default:
      return <Check {...iconProps} />;
  }
};

/**
 * Format timestamp as relative time from start
 * @param currentUs - Current timestamp in microseconds
 * @param startUs - Start timestamp in microseconds
 * @param prevUs - Previous span timestamp for delta (optional)
 */
const formatRelativeTime = (currentUs: number, startUs: number, prevUs?: number): string => {
  const diffMs = (currentUs - startUs) / 1000;
  const minutes = Math.floor(diffMs / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);
  const milliseconds = Math.floor(diffMs % 1000);

  const baseTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;

  if (prevUs !== undefined) {
    const deltaMs = Math.round((currentUs - prevUs) / 1000);
    return `${baseTime} (+${deltaMs}ms)`;
  }

  return baseTime;
};

/**
 * Get status-based styling
 */
const getStatusStyles = (status: SpanStatus, isActive: boolean): {
  cardClass: string;
  headerClass: string;
  glowClass: string;
} => {
  if (status === 'ERROR') {
    return {
      cardClass: 'border-[#ff6b00]/50', // warning-orange
      headerClass: 'bg-[#ff6b00]/5',
      glowClass: '',
    };
  }

  if (status === 'OK') {
    return {
      cardClass: 'border-[#0bda57]/30', // matrix-green
      headerClass: 'bg-[#0bda57]/5',
      glowClass: '',
    };
  }

  // UNSET (active/running)
  if (isActive) {
    return {
      cardClass: 'border-primary/50',
      headerClass: 'bg-primary/5',
      glowClass: 'shadow-[0_0_10px_rgba(17,164,212,0.1)]',
    };
  }

  return {
    cardClass: 'border-slate-200 dark:border-slate-700',
    headerClass: 'bg-slate-50 dark:bg-[#151f24]',
    glowClass: '',
  };
};

/**
 * Render content based on span type and attributes
 */
const SpanContent = ({ span, isExpanded }: { span: Span; isExpanded: boolean }) => {
  const { spanType, attributes, name } = span;
  const [showDetails, setShowDetails] = useState(false);

  // Extract content from attributes
  const content = attributes.content || attributes.input || attributes.output || attributes.message;
  const rawToolName = attributes.tool_name || (attributes.tool as Record<string, unknown>)?.name || attributes["tool.name"];
  const toolName = typeof rawToolName === 'string' ? rawToolName : null;
  const toolOutput = attributes.output || attributes.result || attributes["tool.result"];
  const toolArgs = attributes.arguments || attributes.args || attributes["tool.arguments"];

  // Error Banner - show for any span with ERROR status
  const errorBanner = span.status === 'ERROR' ? (
    <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-xs">
      <div className="flex items-center gap-2 font-semibold text-red-500 mb-1">
        <span className="material-symbols-outlined text-sm">error</span>
        Error
      </div>
      {span.statusMessage && (
        <div className="font-mono text-red-400 mb-2">{span.statusMessage}</div>
      )}
      {span.events.filter(e => e.name === 'exception').map((e, i) => (
        <div key={i} className="mt-2 pt-2 border-t border-red-500/10">
          <div className="font-semibold text-red-400">{(e.attributes.type as string) || 'Exception'}</div>
          <div className="font-mono text-slate-400">{e.attributes.message as string}</div>
        </div>
      ))}
    </div>
  ) : null;

  // User input - show as quoted text
  if (spanType === 'user_input' || spanType === 'user.prompt') {
    return (
      <div className="flex flex-col">
        {errorBanner}
        <div className="p-4 font-mono text-sm text-slate-700 dark:text-slate-300">
          "{typeof content === 'string' ? content : JSON.stringify(content)}"
        </div>
      </div>
    );
  }

  // Tool result - show the returned value
  if (spanType === 'tool.result') {
    return (
      <div className="flex flex-col">
        {errorBanner}
        <div className="p-4 bg-green-500/5 border-t border-green-500/20">
          <div className="text-xs font-medium text-green-600 dark:text-green-400 mb-2">
            Returned from {toolName || 'tool'}:
          </div>
          <JsonRenderer value={toolOutput} />
        </div>
      </div>
    );
  }

  // Tool call - show function signature with expandable details
  if (spanType === 'tool.call') {
    const argsRecord = (toolArgs || {}) as Record<string, unknown>;
    const hasArgs = Object.keys(argsRecord).length > 0;
    const displayName = toolName ?? name;

    return (
      <>
        {/* Python function-style signature (always visible) */}
        <div className="p-4 bg-[#0e1116] border-b border-slate-800">
          <code className="font-mono text-xs text-green-400">
            <span className="text-purple-400">def</span>{' '}
            <span className="text-yellow-300">{displayName}</span>
            {hasArgs && (
              <span>
                ({Object.entries(argsRecord).map(([key, val], i) => (
                  <span key={key}>
                    {i > 0 ? ', ' : null}
                    <span className="text-blue-400">{key}</span>=
                    <span className="text-green-300">
                      {typeof val === 'string' ? `'${val.slice(0, 50)}${val.length > 50 ? '...' : ''}'` : JSON.stringify(val).slice(0, 50)}
                    </span>
                  </span>
                ))})
              </span>
            )}
          </code>
        </div>

        {/* Truncated output summary (always visible when output exists) */}
        {toolOutput && (
          <div className="px-4 py-2 bg-slate-50 dark:bg-surface-dark flex items-center gap-2">
            <span className="text-slate-400">
              <ArrowDownToLine size={14} />
            </span>
            <span className="text-xs font-mono text-slate-500">Output:</span>
            <code className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate max-w-md">
              {typeof toolOutput === 'string' ? toolOutput.slice(0, 100) : JSON.stringify(toolOutput).slice(0, 100)}
            </code>
          </div>
        )}

        {/* Show Details toggle */}
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="w-full px-4 py-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-400 hover:text-slate-200 bg-slate-900/40 hover:bg-slate-800/60 border-t border-slate-700/40 transition-colors"
        >
          {showDetails ? <EyeOff size={12} /> : <Eye size={12} />}
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>

        {/* Expanded detail view */}
        {showDetails && (
          <div className="border-t border-slate-700/40 bg-[#0e1116]">
            {hasArgs ? (
              <div className="px-4 pt-3 pb-2">
                <div className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-1.5">Input</div>
                <JsonRenderer value={argsRecord} />
              </div>
            ) : null}
            {/* Output section */}
            {toolOutput != null && (
              <div className="px-4 pt-2 pb-3 border-t border-slate-700/30">
                <div className="text-[10px] font-semibold text-green-400 uppercase tracking-wider mb-1.5">Output</div>
                <JsonRenderer value={toolOutput} />
              </div>
            )}
          </div>
        )}
        {errorBanner}
      </>
    );
  }

  // Model reasoning - show thinking process
  if (spanType === 'model.reasoning') {
    const reasoning = attributes.reasoning || attributes["model.reasoning"] || content;
    return (
      <div className="flex flex-col">
        {errorBanner}
        <div className="p-4 font-mono text-sm text-slate-600 dark:text-slate-300 bg-amber-500/5 leading-relaxed">
          {reasoning ? (
            <div className="whitespace-pre-wrap">
              <span className="text-amber-500 opacity-60">// Model reasoning</span>
              <br />
              {typeof reasoning === 'string' ? reasoning : JSON.stringify(reasoning, null, 2)}
            </div>
          ) : (
            <span className="text-slate-500 italic">No reasoning captured</span>
          )}
        </div>
      </div>
    );
  }

  // Agent run - content rendered via children spans
  if (spanType === 'agent.run') {
    return <>{errorBanner}</>;
  }

  // Agent delegation - show delegation info with target agent
  if (spanType === 'agent.delegation') {
    const targetAgent = attributes["delegation.target_agent"] as string;
    const query = attributes["delegation.query"] as string;
    const resultStatus = attributes["result.status"] as string;
    
    return (
      <>
        {errorBanner}
        <div className="p-4 border-b border-orange-500/20 bg-orange-500/5">
          <div className="flex items-center gap-2 mb-2">
            <GitBranch size={14} className="text-orange-500" />
            <span className="text-sm font-medium text-orange-500">Delegated to:</span>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {targetAgent || 'unknown'} agent
            </span>
            {resultStatus && (
              <span className={`ml-2 px-2 py-0.5 text-[10px] font-bold rounded ${
                resultStatus === 'completed' 
                  ? 'bg-green-500/20 text-green-500' 
                  : 'bg-red-500/20 text-red-500'
              }`}>
                {resultStatus.toUpperCase()}
              </span>
            )}
          </div>
          {query && (
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono italic line-clamp-2">
              "{query}"
            </div>
          )}
        </div>
      </>
    );
  }

  // Model response - show output (use JSON viewer for structured/final responses)
  if (spanType === 'model.response') {
    const output = attributes.output || attributes.content || content;
    const isFinal = name.includes(':final');
    return (
      <div className="p-4">
        {errorBanner}
        {isFinal && (
          <div className="text-xs font-semibold text-matrix-green mb-2 uppercase tracking-wider">
            Structured Output
          </div>
        )}
        <JsonRenderer value={output} />
        {span.status === 'UNSET' && (
          <span className="inline-block w-2 h-4 bg-primary align-middle ml-1 animate-pulse" />
        )}
      </div>
    );
  }

  // Default - show attributes
  return (
    <div className="flex flex-col">
      {errorBanner}
      <div className="p-4 font-mono text-sm text-slate-600 dark:text-slate-300">
        {isExpanded ? (
          <pre className="whitespace-pre-wrap overflow-auto text-xs">
            {JSON.stringify(attributes, null, 2)}
          </pre>
        ) : (
          <span className="text-slate-500 italic">
            {name} - {Object.keys(attributes).length} attributes
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * SpanNode Component
 * 
 * Renders an individual span in the timeline with:
 * - Inline span type indicator
 * - Timestamp display
 * - Expandable content area
 * - Status-based styling
 */
export function SpanNode({
  span,
  startTime,
  isExpanded = false,
  onToggle,
  depth = 0,
  forceExpanded,
  forceExpandedSignal,
  forceContentExpanded,
  forceContentExpandedSignal,
}: SpanNodeProps) {
  const [internalChildrenExpanded, setInternalChildrenExpanded] = useState(() => {
    if (typeof forceExpanded === 'boolean') return forceExpanded;
    if (isExpanded) return true;
    // agent.run and agent.delegation show content via children, so expand by default
    if (span.spanType === 'agent.run' || span.spanType === 'agent.delegation') {
      return true;
    }
    if (span.spanType === 'model.request' || span.spanType === 'model.response') {
      return false;
    }
    return isExpanded;
  });
  const [isContentExpanded, setIsContentExpanded] = useState(() => {
    if (typeof forceContentExpanded === 'boolean') return forceContentExpanded;
    return true;
  });

  const childrenExpanded = onToggle ? isExpanded : internalChildrenExpanded;

  useEffect(() => {
    if (typeof forceExpanded === 'boolean' && forceExpanded !== internalChildrenExpanded) {
      setInternalChildrenExpanded(forceExpanded);
    }
  }, [forceExpanded, forceExpandedSignal]);

  useEffect(() => {
    if (typeof forceContentExpanded === 'boolean' && forceContentExpanded !== isContentExpanded) {
      setIsContentExpanded(forceContentExpanded);
    }
  }, [forceContentExpanded, forceContentExpandedSignal]);

  const config = spanTypeConfigs[span.spanType] || spanTypeConfigs['agent.run'];
  const isActive = span.status === 'UNSET';
  const statusStyles = getStatusStyles(span.status, isActive);

  // Calculate relative timestamp
  const relativeTime = formatRelativeTime(span.startTime, startTime);

  // Calculate duration if available
  const duration = span.durationUs
    ? `${(span.durationUs / 1000).toFixed(1)}ms`
    : span.endTime
      ? `${((span.endTime - span.startTime) / 1000).toFixed(1)}ms`
      : null;

  const handleToggle = () => {
    setIsContentExpanded(!isContentExpanded);
    if (hasChildren) {
      if (onToggle) {
        onToggle();
      } else {
        setInternalChildrenExpanded(!childrenExpanded);
      }
    }
  };

  const hasChildren = span.children && span.children.length > 0;
  const indentPx = depth > 0 ? NESTING_INDENT_PX : 0;
  const subtreeIndentPx = getMaxDescendantDepth(span) * NESTING_INDENT_PX;

  return (
    <div
      className="relative mb-4 group"
      style={{
        marginLeft: indentPx,
        width: `calc(var(--trace-readable-width) + ${subtreeIndentPx}px)`,
      }}
    >
      {/* Content card */}
      <div
        className={`bg-white dark:bg-[#1a262b] border ${statusStyles.cardClass} rounded-sm shadow-sm transition-all hover:border-opacity-70 ${isActive ? statusStyles.glowClass : ''
          }`}
      >
        {/* Header */}
        <div
          className={`px-4 py-2 ${isContentExpanded ? `border-b ${config.borderColor}/20` : ''} ${statusStyles.headerClass} cursor-pointer`}
          onClick={handleToggle}
        >
          <div
            className="box-border flex w-full min-w-0 items-center gap-3"
            style={{ maxWidth: 'var(--trace-readable-width)' }}
          >
            <span className={`min-w-0 flex-1 text-xs font-bold ${config.color} uppercase tracking-wider flex items-center gap-2`}>
              {isContentExpanded
                ? <ChevronDown size={12} />
                : <ChevronRight size={12} />
              }
              <span
                className={`relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${config.bgColor} border-2 ${config.borderColor} ${isActive ? 'shadow-[0_0_10px_rgba(17,164,212,0.4)]' : ''}`}
              >
                <SpanIcon type={span.spanType} className={config.color} />
                {isActive && (
                  <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                )}
              </span>
              {config.label}
              {span.name && span.spanType !== 'user_input' && (
                <span className="min-w-0 truncate font-normal text-slate-500 dark:text-slate-400 normal-case">
                  : {span.name}
                </span>
              )}
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              )}
            </span>
            <div className="ml-auto flex w-36 shrink-0 items-center justify-end gap-2 font-mono tabular-nums">
              {duration && (
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {duration}
                </span>
              )}
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {relativeTime}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        {isContentExpanded && (
          <SpanContent span={span} isExpanded={isContentExpanded} />
        )}

        {/* Children */}
        {hasChildren && childrenExpanded && isContentExpanded && (
          <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 py-4">
            {span.children!.map((child) => (
              <SpanNode
                key={child.id}
                span={child}
                startTime={startTime}
                depth={depth + 1}
                forceExpanded={forceExpanded}
                forceExpandedSignal={forceExpandedSignal}
                forceContentExpanded={forceContentExpanded}
                forceContentExpandedSignal={forceContentExpandedSignal}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SpanNode;
