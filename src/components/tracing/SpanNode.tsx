import { useEffect, useState } from 'react';
import type { Span, SpanType, SpanStatus, SpanNodeProps, SpanTypeConfig } from '@/types/tracing';
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
  
  // Extract content from attributes
  const content = attributes.content || attributes.input || attributes.output || attributes.message;
  const rawToolName = attributes.tool_name || (attributes.tool as Record<string, unknown>)?.name || attributes["tool.name"];
  const toolName = typeof rawToolName === 'string' ? rawToolName : null;
  const toolOutput = attributes.output || attributes.result || attributes["tool.result"];
  const toolArgs = attributes.arguments || attributes.args || attributes["tool.arguments"];
  
  // User input - show as quoted text
  if (spanType === 'user_input' || spanType === 'user.prompt') {
    return (
      <div className="p-4 font-mono text-sm text-slate-700 dark:text-slate-300">
        "{typeof content === 'string' ? content : JSON.stringify(content)}"
      </div>
    );
  }
  
  // Tool result - show the returned value
  if (spanType === 'tool.result') {
    return (
      <div className="p-4 bg-green-500/5 border-t border-green-500/20">
        <div className="text-xs font-medium text-green-600 dark:text-green-400 mb-2">
          Returned from {toolName || 'tool'}:
        </div>
        <pre className="font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap overflow-auto max-h-64">
          {typeof toolOutput === 'string' 
            ? toolOutput 
            : JSON.stringify(toolOutput, null, 2)}
        </pre>
      </div>
    );
  }
  
  // Tool call - show function signature and output
  if (spanType === 'tool.call') {
    const argsRecord = (toolArgs || {}) as Record<string, unknown>;
    const hasArgs = Object.keys(argsRecord).length > 0;
    const displayName = toolName ?? name;
    
    return (
      <>
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
        {toolOutput && (
          <div className="px-4 py-2 bg-slate-50 dark:bg-[#151f24] flex items-center gap-2">
            <span className="text-slate-400">
              <ArrowDownToLine size={14} />
            </span>
            <span className="text-xs font-mono text-slate-500">Output:</span>
            <code className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate max-w-md">
              {typeof toolOutput === 'string' ? toolOutput.slice(0, 100) : JSON.stringify(toolOutput).slice(0, 100)}
            </code>
          </div>
        )}
      </>
    );
  }
  
  // Model reasoning - show thinking process
  if (spanType === 'model.reasoning') {
    const reasoning = attributes.reasoning || attributes["model.reasoning"] || content;
    return (
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
    );
  }
  
  // Agent run - show reasoning/thought
  if (spanType === 'agent.run') {
    const thought = (attributes.thought || attributes.reasoning || content) as any;
    const output = (attributes.output || attributes.result) as any;
    
    return (
      <div className="p-4 font-mono text-sm text-slate-600 dark:text-slate-300 bg-primary/5 leading-relaxed">
        {thought ? (
          <>
            <span className="text-primary opacity-60">// Reasoning process</span>
            <br />
            {typeof thought === 'string' ? thought : JSON.stringify(thought, null, 2)}
          </>
        ) : (
          <span className="text-slate-500 italic">No reasoning captured</span>
        )}
        
        {/* Agent Result Display */}
        {output && (
          <div className="mt-4 pt-4 border-t border-primary/20">
            <span className="text-primary opacity-60 block mb-2">// Final Result</span>
            <div className="bg-slate-50 dark:bg-[#151f24] p-3 rounded border border-primary/10 font-mono text-xs overflow-auto max-h-80">
              {typeof output === 'string' 
                ? output 
                : JSON.stringify(output, null, 2)}
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // Model response - show output
  if (spanType === 'model.response') {
    const output = attributes.output || attributes.content || content;
    return (
      <div className="p-4 font-mono text-sm text-slate-700 dark:text-slate-300">
        {typeof output === 'string' ? output : (
          <pre className="whitespace-pre-wrap overflow-auto">
            {JSON.stringify(output, null, 2)}
          </pre>
        )}
        {span.status === 'UNSET' && (
          <span className="inline-block w-2 h-4 bg-primary align-middle ml-1 animate-pulse" />
        )}
      </div>
    );
  }
  
  // Default - show attributes
  return (
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
  );
};

/**
 * SpanNode Component
 * 
 * Renders an individual span in the timeline with:
 * - Circular icon indicator
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
}: SpanNodeProps) {
  const [internalExpanded, setInternalExpanded] = useState(() => {
    if (isExpanded) return true;
    // Default collapse for model.request and model.response
    if (span.spanType === 'model.request' || span.spanType === 'model.response') {
      return false;
    }
    return isExpanded;
  });
  const expanded = onToggle ? isExpanded : internalExpanded;

  useEffect(() => {
    if (typeof forceExpanded === 'boolean') {
      setInternalExpanded(forceExpanded);
    }
  }, [forceExpanded, forceExpandedSignal]);
  
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
    if (onToggle) {
      onToggle();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };
  
  const hasChildren = span.children && span.children.length > 0;
  
  return (
    <div 
      className="relative pl-16 mb-8 group"
      style={{ marginLeft: depth * 24 }}
    >
      {/* Icon circle on timeline */}
      <div 
        className={`absolute left-3 top-0 w-6 h-6 rounded-full ${config.bgColor} border-2 ${config.borderColor} z-10 flex items-center justify-center ${
          isActive ? 'shadow-[0_0_10px_rgba(17,164,212,0.4)]' : ''
        }`}
      >
        <SpanIcon type={span.spanType} className={config.color} />
        {isActive && (
          <span className="absolute w-1.5 h-1.5 rounded-full bg-primary animate-pulse -top-0.5 -right-0.5" />
        )}
      </div>
      
      {/* Content card */}
      <div 
        className={`bg-white dark:bg-[#1a262b] border ${statusStyles.cardClass} rounded-sm shadow-sm overflow-hidden transition-all hover:border-opacity-70 ${
          isActive ? statusStyles.glowClass : ''
        }`}
      >
        {/* Header */}
        <div 
          className={`px-4 py-2 border-b ${config.borderColor}/20 ${statusStyles.headerClass} flex justify-between items-center cursor-pointer`}
          onClick={handleToggle}
        >
          <span className={`text-xs font-bold ${config.color} uppercase tracking-wider flex items-center gap-2`}>
            {hasChildren && (
              expanded 
                ? <ChevronDown size={12} /> 
                : <ChevronRight size={12} />
            )}
            {config.label}
            {span.name && span.spanType !== 'user_input' && (
              <span className="font-normal text-slate-500 dark:text-slate-400 normal-case">
                : {span.name}
              </span>
            )}
            {isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            )}
          </span>
          <div className="flex items-center gap-2">
            {duration && (
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                {duration}
              </span>
            )}
            <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
              {relativeTime}
            </span>
          </div>
        </div>
        
        {/* Content */}
        {(expanded || !hasChildren) && (
          <SpanContent span={span} isExpanded={expanded} />
        )}
        
        {/* Children */}
        {hasChildren && expanded && (
          <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 p-4">
            {span.children!.map((child) => (
              <SpanNode
                key={child.id}
                span={child}
                startTime={startTime}
                depth={depth + 1}
                forceExpanded={forceExpanded}
                forceExpandedSignal={forceExpandedSignal}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SpanNode;
