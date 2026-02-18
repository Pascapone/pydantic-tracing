/**
 * WebSocket Manager - Manages WebSocket connections and broadcasts trace events
 */
import type { TraceEvent } from "./trace-watcher";

// ============================================================================
// Types
// ============================================================================

export interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}

export interface WebSocketClient {
  id: string;
  subscriptions: Set<string>;
  send: (data: string) => void;
  close: () => void;
}

// ============================================================================
// WebSocketManager Class
// ============================================================================

export class WebSocketManager {
  private clients: Map<string, WebSocketClient> = new Map();
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start ping interval
    this.pingInterval = setInterval(() => {
      this.broadcast({ type: "ping" });
    }, 30000); // Every 30 seconds
  }

  /**
   * Register a new WebSocket client
   */
  addClient(client: WebSocketClient): void {
    this.clients.set(client.id, client);
    console.log(`[WebSocket] Client connected: ${client.id}`);
  }

  /**
   * Remove a WebSocket client
   */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions.clear();
      this.clients.delete(clientId);
      console.log(`[WebSocket] Client disconnected: ${clientId}`);
    }
  }

  /**
   * Get a client by ID
   */
  getClient(clientId: string): WebSocketClient | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Handle incoming message from a client
   */
  handleMessage(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case "subscribe:traces":
        client.subscriptions.add("traces");
        console.log(`[WebSocket] Client ${clientId} subscribed to all traces`);
        break;

      case "subscribe:trace":
        if (message.traceId && typeof message.traceId === "string") {
          client.subscriptions.add(`trace:${message.traceId}`);
          console.log(
            `[WebSocket] Client ${clientId} subscribed to trace ${message.traceId}`
          );
        }
        break;

      case "unsubscribe:trace":
        if (message.traceId && typeof message.traceId === "string") {
          client.subscriptions.delete(`trace:${message.traceId}`);
          console.log(
            `[WebSocket] Client ${clientId} unsubscribed from trace ${message.traceId}`
          );
        }
        break;

      case "pong":
        // Keepalive response - nothing to do
        break;

      default:
        console.log(
          `[WebSocket] Unknown message type from ${clientId}:`,
          message.type
        );
    }
  }

  /**
   * Broadcast a trace event to all subscribed clients
   */
  broadcastTraceEvent(event: TraceEvent): void {
    const message = JSON.stringify(event);

    for (const [clientId, client] of this.clients) {
      // Check if client is subscribed to all traces
      if (client.subscriptions.has("traces")) {
        try {
          client.send(message);
        } catch (error) {
          console.error(
            `[WebSocket] Error sending to client ${clientId}:`,
            error
          );
        }
        continue;
      }

      // Check if client is subscribed to this specific trace
      let traceId: string | undefined;
      if (event.type === "trace:created" || event.type === "trace:updated") {
        traceId = event.trace.id;
      } else if (event.type === "span:created") {
        traceId = event.traceId;
      }

      if (traceId && client.subscriptions.has(`trace:${traceId}`)) {
        try {
          client.send(message);
        } catch (error) {
          console.error(
            `[WebSocket] Error sending to client ${clientId}:`,
            error
          );
        }
      }
    }
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(message: WebSocketMessage): void {
    const data = JSON.stringify(message);

    for (const [clientId, client] of this.clients) {
      try {
        client.send(data);
      } catch (error) {
        console.error(
          `[WebSocket] Error broadcasting to client ${clientId}:`,
          error
        );
      }
    }
  }

  /**
   * Get the number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Clean up and stop the ping interval
   */
  destroy(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      try {
        client.close();
      } catch {
        // Ignore errors on close
      }
    }
    this.clients.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let managerInstance: WebSocketManager | null = null;

/**
 * Get the singleton WebSocketManager instance
 */
export function getWebSocketManager(): WebSocketManager {
  if (!managerInstance) {
    managerInstance = new WebSocketManager();
  }
  return managerInstance;
}

/**
 * Destroy the singleton WebSocketManager
 */
export function destroyWebSocketManager(): void {
  if (managerInstance) {
    managerInstance.destroy();
    managerInstance = null;
  }
}
