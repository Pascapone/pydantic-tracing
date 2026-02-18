import { useState, useCallback } from 'react';
import JsonView from '@uiw/react-json-view';
import { vscodeTheme } from '@uiw/react-json-view/vscode';
import { ChevronsUpDown, ChevronsDownUp } from 'lucide-react';

/**
 * Try to parse a value as JSON. Returns the parsed object if successful,
 * or null if the value is not a JSON string / is already a primitive.
 */
function tryParseJson(value: unknown): object | null {
  if (value !== null && typeof value === 'object') return value as object;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'object' && parsed !== null) return parsed;
    return null;
  } catch {
    return null;
  }
}

export interface JsonRendererProps {
  /** The value to render. Accepts objects, JSON strings, or plain text. */
  value: unknown;
  /** Default expansion depth. 1 = only root expanded. Default: 1 */
  defaultExpandLevel?: number;
  /** Additional CSS classes for the wrapper */
  className?: string;
  /** Max height in CSS units. Default: '24rem' (max-h-96) */
  maxHeight?: string;
  /** Whether to show expand/collapse all buttons. Default: true */
  showControls?: boolean;
}

/**
 * Reusable JSON renderer with expand/collapse all controls.
 *
 * - Automatically detects JSON strings and parses them
 * - Falls back to a <pre> block for plain-text values
 * - Default expansion level is 1 (root expanded, all children collapsed)
 * - Expand All / Collapse All toolbar buttons
 */
export function JsonRenderer({
  value,
  defaultExpandLevel = 1,
  className = '',
  maxHeight = '24rem',
  showControls = true,
}: JsonRendererProps) {
  const parsed = tryParseJson(value);

  // collapsed state: number = collapse level, false = expand all
  const [collapsed, setCollapsed] = useState<number | false>(defaultExpandLevel);
  // Signal to force re-render of JsonView when toggling
  const [signal, setSignal] = useState(0);

  const handleExpandAll = useCallback(() => {
    setCollapsed(false);
    setSignal((s) => s + 1);
  }, []);

  const handleCollapseAll = useCallback(() => {
    setCollapsed(defaultExpandLevel);
    setSignal((s) => s + 1);
  }, [defaultExpandLevel]);

  // Plain text fallback
  if (!parsed) {
    return (
      <pre
        className={`font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap overflow-auto ${className}`}
        style={{ maxHeight }}
      >
        {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  return (
    <div className={className}>
      {/* Expand / Collapse controls */}
      {showControls && (
        <div className="flex items-center gap-1 mb-1">
          <button
            type="button"
            onClick={handleExpandAll}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-700/60 rounded transition-colors"
            title="Expand All"
          >
            <ChevronsUpDown size={10} />
            Expand
          </button>
          <button
            type="button"
            onClick={handleCollapseAll}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-700/60 rounded transition-colors"
            title="Collapse All"
          >
            <ChevronsDownUp size={10} />
            Collapse
          </button>
        </div>
      )}

      <div className="rounded overflow-auto text-xs" style={{ maxHeight }}>
        <JsonView
          key={signal}
          value={parsed}
          style={{
            ...vscodeTheme,
            background: 'transparent',
            fontSize: '12px',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          }}
          collapsed={collapsed}
          displayDataTypes={false}
          displayObjectSize={false}
          enableClipboard
          shortenTextAfterLength={120}
        />
      </div>
    </div>
  );
}

export default JsonRenderer;
