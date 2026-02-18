# Walkthrough: React Trace Components - Core UI

**Task ID:** react-trace-components-core
**Erstellt:** 2026-02-17
**Status:** Abgeschlossen

## Übersicht

Implementierung der Core React Components für das Trace Terminal UI. Die Components basieren auf dem Design aus `design/tracing-design-concept.html` und folgen den Patterns aus den existierenden Job-Komponenten.

## Erstellte Dateien

```
src/components/tracing/
├── TraceTerminal.tsx   # Main container (128 Zeilen)
├── TraceHeader.tsx     # Top navigation (81 Zeilen)
├── TraceSidebar.tsx    # Left panel (121 Zeilen)
├── TraceStats.tsx      # Stats grid (77 Zeilen)
└── index.ts            # Exports
```

## Implementierungsdetails

### 1. TraceStats.tsx

**Zweck:** Stats Grid Component mit drei Karten

**Features:**
- **Status Card:** Zeigt "RUNNING" mit animiertem pulsing green dot oder "IDLE"
- **Latency Card:** Zeigt Latency in ms mit Change Indicator (▲/▼)
- **Token Budget Card:** Progress bar mit used/total Anzeige (spans 2 columns)

**Color Theme:**
```tsx
// Pulsing indicator
<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-matrix-green opacity-75"></span>
<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-matrix-green"></span>

// Change indicator
{isPositive ? "text-matrix-green" : "text-warning-orange"}
```

### 2. TraceSidebar.tsx

**Zweck:** Left Panel (w-80) mit Stats Grid und Trace List

**Features:**
- Importiert und rendert `TraceStats` Component
- Scrollable Trace List mit Selection Support
- Status Badges für Active/Done/Error
- Time-ago und Token formatting

**Status Config:**
```tsx
const statusConfig = {
  active: {
    badge: "bg-matrix-green/20 text-matrix-green",
    label: "Active",
  },
  done: {
    badge: "bg-slate-200 dark:bg-slate-700 text-slate-500",
    label: "Done",
  },
  error: {
    badge: "bg-warning-orange/20 text-warning-orange",
    label: "Error",
  },
};
```

**Helper Functions:**
- `formatTimeAgo()`: "2s ago", "1m ago", etc.
- `formatTokens()`: "1.2k" für >= 1000 tokens

### 3. TraceHeader.tsx

**Zweck:** Top Navigation Bar (h-16)

**Features:**
- Logo mit Terminal Icon (Lucide)
- Title "Trace Terminal v1.0"
- Global Search Input mit Search Icon
- Navigation Tabs (Dashboard, Traces, Settings)
- Notification und Account Buttons

**Search Input Styling:**
```tsx
<div className="relative w-64 group">
  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
    <Search size={16} />
  </div>
  <input className="block w-full pl-10 pr-3 py-1.5 bg-slate-100 dark:bg-[#151f24] border border-slate-300 dark:border-slate-700 rounded-sm text-sm placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono" />
</div>
```

### 4. TraceTerminal.tsx

**Zweck:** Main Container mit Three-Column Layout

**Layout Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│                     TraceHeader (h-16)                      │
├──────────────┬─────────────────────────┬────────────────────┤
│ TraceSidebar │    Center Timeline      │   Log Stream       │
│    (w-80)    │       (flex-1)          │     (w-96)         │
│              │                         │                    │
│  [Stats]     │  [Placeholder]          │  [Placeholder]     │
│  [Traces]    │                         │                    │
└──────────────┴─────────────────────────┴────────────────────┘
```

**Props:**
```tsx
interface TraceTerminalProps {
  jobId?: string;
  traceId?: string;
  onTraceSelect?: (id: string) => void;
}
```

**Demo Data:**
- Default Stats: Running, 420ms latency, 1204/4000 tokens
- Default Traces: 3 sample traces (8842-X, 8841-B, 8840-A)

**State Management:**
```tsx
const [activeTab, setActiveTab] = useState<"dashboard" | "traces" | "settings">("traces");
const [searchValue, setSearchValue] = useState("");
const [selectedTraceId, setSelectedTraceId] = useState<string | undefined>(initialTraceId);
```

## Styling Referenz

### Tailwind Classes (Dark Mode)

```css
/* Backgrounds */
bg-background-dark   /* #101d22 - Main background */
bg-surface-dark      /* #1a262b - Surface panels */
bg-[#151f24]         /* Input backgrounds */
bg-[#0e1116]         /* Code/log blocks */
bg-[#0c1214]         /* Center timeline area */

/* Primary Color */
text-primary         /* #11a4d4 */
bg-primary           /* #11a4d4 */
border-primary       /* #11a4d4 */

/* Status Colors */
text-matrix-green    /* #0bda57 - success/active */
bg-matrix-green/20   /* Badge background */
text-warning-orange  /* #ff6b00 - errors/warnings */

/* Borders */
border-slate-800     /* Main borders */
border-slate-700     /* Surface borders */

/* Text */
text-slate-100       /* Primary text */
text-slate-400       /* Secondary text */
text-slate-500       /* Muted text */
```

## Icons verwendet

| Icon | Component | Purpose |
|------|-----------|---------|
| `Terminal` | TraceHeader | Logo |
| `Search` | TraceHeader | Search input icon |
| `Bell` | TraceHeader | Notifications button |
| `User` | TraceHeader | Account button |
| `Clock` | TraceSidebar | Timestamp icon |
| `Coins` | TraceSidebar | Token count icon |
| `Activity` | TraceStats | Idle status icon |

## Probleme & Lösungen

### Problem 1: Type Export Konflikt
**Fehler:** `TraceStatsData` wurde nicht korrekt exportiert

**Lösung:**
- Type wird in `TraceStats.tsx` definiert und exportiert
- `TraceSidebar.tsx` importiert den Type von dort
- `index.ts` re-exportiert den Type von `TraceStats.tsx`

### Problem 2: Dark Mode Default
**Anforderung:** Dark Mode als Default

**Lösung:**
- Verwendung von `dark:` prefix für alle color classes
- Parent Container hat `dark:bg-background-dark`
- Alle Surface Components nutzen `dark:bg-surface-dark`

## Integration Notes

### Verwendung in Route

```tsx
import { TraceTerminal } from "@/components/tracing";

export const Route = createFileRoute("/traces/")({
  component: TracesPage,
});

function TracesPage() {
  return <TraceTerminal />;
}
```

### Mit Job Integration

```tsx
<TraceTerminal
  jobId="job-123"
  traceId="trace-456"
  onTraceSelect={(id) => console.log("Selected:", id)}
/>
```

## Nächste Schritte

1. **TraceTimeline.tsx** - Implementiere Timeline Visualization
2. **TraceLogStream.tsx** - Implementiere Raw Log Stream
3. **SpanNode.tsx** - Implementiere individual span nodes
4. **API Integration** - Verbinde mit `/api/traces` endpoints
5. **use-traces.ts Hook** - Implementiere data fetching hook

## Acceptance Criteria Status

| Kriterium | Status |
|-----------|--------|
| TraceTerminal rendert three-column layout | ✅ |
| TraceHeader zeigt navigation und search | ✅ |
| TraceSidebar zeigt stats grid und trace list | ✅ |
| TraceStats zeigt alle drei stat cards korrekt | ✅ |
| Dark mode styling angewendet | ✅ |
| Lucide icons verwendet | ✅ |
