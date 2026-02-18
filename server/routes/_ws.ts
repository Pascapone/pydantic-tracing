/**
 * WebSocket Route Handler for Real-time Trace Updates
 * 
 * This handler is used by Nitro's experimental WebSocket support.
 * 
 * Protocol:
 * 
 * Client → Server:
 * - { "type": "subscribe:traces" } - Subscribe to all trace updates
 * - { "type": "subscribe:trace", "traceId": "..." } - Subscribe to specific trace
 * - { "type": "unsubscribe:trace", "traceId": "..." } - Unsubscribe from trace
 * - { "type": "pong" } - Keepalive response
 * 
 * Server → Client:
 * - { "type": "trace:created", "trace": {...} }
 * - { "type": "trace:updated", "trace": {...} }
 * - { "type": "span:created", "span": {...}, "traceId": "..." }
 * - { "type": "ping" } - Keepalive
 */
import { defineWebSocketHandler } from "h3";
import { randomUUID } from "crypto";
import {
  getWebSocketManager,
  getTraceWatcher,
  destroyWebSocketManager,
  stopTraceWatcher,
} from "../../src/lib/websocket/index";

// Initialize manager and watcher
const wsManager = getWebSocketManager();
const traceWatcher = getTraceWatcher((event) => {
  wsManager.broadcastTraceEvent(event);
});
let isWatcherRunning = false;

function ensureWatcherRunning() {
  if (!isWatcherRunning) {
    traceWatcher.start();
    isWatcherRunning = true;
  }
}

function stopWatcherIfIdle() {
  if (isWatcherRunning && wsManager.getClientCount() === 0) {
    traceWatcher.stop();
    isWatcherRunning = false;
  }
}

export default defineWebSocketHandler({
  /**
   * Handle new WebSocket connection
   */
  open(peer) {
    ensureWatcherRunning();

    const clientId = randomUUID();
    
    // Store client ID in peer context
    (peer as any)._clientId = clientId;
    
    // Register client with manager
    wsManager.addClient({
      id: clientId,
      subscriptions: new Set(),
      send: (data: string) => {
        try {
          peer.send(data);
        } catch {
          // Connection might be closed
        }
      },
      close: () => {
        try {
          peer.close();
        } catch {
          // Already closed
        }
      },
    });

    // Send welcome message
    peer.send(JSON.stringify({
      type: "connected",
      clientId,
      message: "Connected to trace updates WebSocket",
    }));
  },

  /**
   * Handle incoming WebSocket message
   */
  message(peer, message) {
    const clientId = (peer as any)._clientId;
    if (!clientId) return;

    try {
      const data = JSON.parse(message.text() || message.toString());
      wsManager.handleMessage(clientId, data);
    } catch (error) {
      console.error("[WebSocket] Error parsing message:", error);
      peer.send(JSON.stringify({
        type: "error",
        message: "Invalid message format",
      }));
    }
  },

  /**
   * Handle WebSocket close
   */
  close(peer) {
    const clientId = (peer as any)._clientId;
    if (clientId) {
      wsManager.removeClient(clientId);
    }
    stopWatcherIfIdle();
  },

  /**
   * Handle WebSocket error
   */
  error(peer, error) {
    const clientId = (peer as any)._clientId;
    console.error(`[WebSocket] Error for client ${clientId}:`, error);
    
    if (clientId) {
      wsManager.removeClient(clientId);
    }
    stopWatcherIfIdle();
  },
});

// Cleanup on process exit
process.on("beforeExit", () => {
  stopTraceWatcher();
  destroyWebSocketManager();
});
