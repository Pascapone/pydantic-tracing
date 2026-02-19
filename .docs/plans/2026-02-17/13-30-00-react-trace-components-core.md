# Implementierungsplan: React Trace Components - Core UI

**Task ID:** react-trace-components-core
**Erstellt:** 2026-02-17 13:30:00
**Status:** In Progress

## Ziel

Implementierung der Core React Components für das Trace Terminal UI basierend auf dem Design in `design/tracing-design-concept.html`.

## Analyse

### Design-Referenz
Das Design zeigt ein "Industrial Trace Terminal" mit:
- Header mit Navigation und Search
- Left Sidebar (w-80) mit Stats Grid und Trace List
- Center Panel (flex-1) mit Timeline
- Right Sidebar (w-96) mit Raw Log Stream

### Color Theme (Tailwind v4)
```
primary: #11a4d4
background-dark: #101d22
background-light: #f6f8f8
matrix-green: #0bda57
warning-orange: #ff6b00
surface-dark: #1a262b
surface-light: #ffffff
```

## Deliverables

### 1. TraceTerminal.tsx
Main Container mit Three-Column Layout:
- Fixed Header (h-16)
- Three columns: w-80 | flex-1 | w-96
- Dark mode by default

### 2. TraceHeader.tsx
Top Navigation (h-16):
- Logo mit Terminal Icon
- Title "Trace Terminal v1.0"
- Global Search Input
- Navigation Tabs (Dashboard, Traces, Settings)
- Notification und Account Buttons

### 3. TraceSidebar.tsx
Left Panel (w-80):
- Stats Grid (2x2)
- Recent Traces Header
- Scrollable Trace List

### 4. TraceStats.tsx
Stats Grid Component:
- Status Card mit pulsing indicator
- Latency Card mit change indicator
- Token Budget Card mit progress bar

## Interface-Definitionen

```typescript
interface TraceStats {
  status: 'running' | 'idle';
  latency: number;
  latencyChange: number;
  tokenBudget: { used: number; total: number };
}

interface TraceSummary {
  id: string;
  name: string;
  status: 'active' | 'done' | 'error';
  preview: string;
  timestamp: Date;
  tokens: number;
}

interface TraceTerminalProps {
  jobId?: string;
  traceId?: string;
  onTraceSelect?: (id: string) => void;
}

interface TraceSidebarProps {
  traces: TraceSummary[];
  selectedId?: string;
  stats: TraceStats;
  onSelect: (id: string) => void;
  isLoading?: boolean;
}
```

## Implementierungsschritte

1. **Erstelle src/components/tracing/ Verzeichnis**
   - Neue Dateien für alle Komponenten

2. **TraceStats.tsx**
   - Status Card mit animated pulsing dot
   - Latency Card mit ▲/▼ indicator
   - Token Budget Card mit progress bar (col-span-2)

3. **TraceSidebar.tsx**
   - Import TraceStats
   - Stats Grid (p-4, grid-cols-2, gap-3)
   - Recent Traces Header
   - Trace List mit selectable items

4. **TraceHeader.tsx**
   - Logo und Title
   - Search Input mit icon
   - Navigation Tabs
   - Notification/Account Buttons

5. **TraceTerminal.tsx**
   - Import alle Sub-Komponenten
   - Three-Column Layout
   - Default Props für Demo

## Styling-Referenz (aus Design)

### Backgrounds
- Main: `bg-background-dark` (#101d22)
- Surface: `bg-surface-dark` (#1a262b)
- Input/Code: `bg-[#151f24]` / `bg-[#0e1116]`

### Borders
- Main border: `border-slate-800`
- Surface border: `border-slate-700`

### Text
- Primary text: `text-slate-100`
- Secondary text: `text-slate-400`
- Accent: `text-primary` (#11a4d4)

### Status Badges
- Active: `bg-matrix-green/20 text-matrix-green`
- Done: `bg-slate-700 text-slate-500`
- Error: `bg-warning-orange/20 text-warning-orange`

## Icons

Verwende Lucide Icons (bereits im Projekt):
- Terminal: `Terminal`
- Search: `Search`
- Notifications: `Bell`
- Account: `User`
- Schedule: `Clock`
- Token: `Coins`
- Expand: `Expand`
- Refresh: `RefreshCw`
- Pause: `Pause`
- Download: `Download`

## Dateien

```
src/components/tracing/
├── TraceTerminal.tsx   # Main container
├── TraceHeader.tsx     # Top navigation
├── TraceSidebar.tsx    # Left panel
└── TraceStats.tsx      # Stats grid
```

## Abhängigkeiten

- React
- Lucide React (bereits installiert)
- Tailwind CSS v4

## Acceptance Criteria

1. ✓ TraceTerminal rendert three-column layout
2. ✓ TraceHeader zeigt navigation und search
3. ✓ TraceSidebar zeigt stats grid und trace list
4. ✓ TraceStats zeigt alle drei stat cards korrekt
5. ✓ Dark mode styling angewendet
6. ✓ Responsive considerations
7. ✓ Lucide icons verwendet

## Nächste Schritte

Nach Freigabe durch den Manager:
1. Implementierung der 4 Komponenten
2. Erstellung der index.ts für exports
3. Walkthrough-Dokument erstellen
