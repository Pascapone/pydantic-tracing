/**
 * WebSocket Module - Real-time trace updates via WebSocket
 */

export { TraceWatcher, getTraceWatcher, stopTraceWatcher } from "./trace-watcher";
export type { TraceEvent, TraceWatcherOptions } from "./trace-watcher";

export {
  WebSocketManager,
  getWebSocketManager,
  destroyWebSocketManager,
} from "./manager";
export type { WebSocketMessage, WebSocketClient } from "./manager";
