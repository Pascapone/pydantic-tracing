/**
 * useTraceWebSocket - React hook for WebSocket trace updates
 *
 * Provides real-time trace updates via WebSocket connection.
 * Falls back gracefully when WebSocket is not available.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import type { TraceRow, SpanRow } from "@/lib/tracing/db";

// ============================================================================
// Types
// ============================================================================

export interface TraceCreatedEvent {
  type: "trace:created";
  trace: TraceRow;
}

export interface TraceUpdatedEvent {
  type: "trace:updated";
  trace: TraceRow;
}

export interface SpanCreatedEvent {
  type: "span:created";
  span: SpanRow;
  traceId: string;
}

export type TraceWebSocketEvent = TraceCreatedEvent | TraceUpdatedEvent | SpanCreatedEvent;

export interface UseTraceWebSocketOptions {
  /** Auto-connect on mount */
  autoConnect?: boolean;
  /** Callback for trace created events */
  onTraceCreated?: (trace: TraceRow) => void;
  /** Callback for trace updated events */
  onTraceUpdated?: (trace: TraceRow) => void;
  /** Callback for span created events */
  onSpanCreated?: (event: SpanCreatedEvent) => void;
  /** Callback for connection state changes */
  onConnectionChange?: (connected: boolean) => void;
  /** Reconnection delay in ms */
  reconnectDelay?: number;
  /** Max reconnection attempts */
  maxReconnectAttempts?: number;
}

export interface UseTraceWebSocketResult {
  /** Whether the WebSocket is connected */
  isConnected: boolean;
  /** Connection error if any */
  error: Error | null;
  /** Client ID assigned by server */
  clientId: string | null;
  /** Subscribe to all trace updates */
  subscribeToTraces: () => void;
  /** Subscribe to a specific trace */
  subscribeToTrace: (traceId: string) => void;
  /** Unsubscribe from a specific trace */
  unsubscribeFromTrace: (traceId: string) => void;
  /** Manually connect */
  connect: () => void;
  /** Disconnect from WebSocket */
  disconnect: () => void;
}

interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useTraceWebSocket(
  options?: UseTraceWebSocketOptions
): UseTraceWebSocketResult {
  const {
    autoConnect = true,
    onTraceCreated,
    onTraceUpdated,
    onSpanCreated,
    onConnectionChange,
    reconnectDelay = 1000,
    maxReconnectAttempts = 10,
  } = options || {};

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(true);
  const intentionalCloseRef = useRef(false);

  const onTraceCreatedRef = useRef(onTraceCreated);
  const onTraceUpdatedRef = useRef(onTraceUpdated);
  const onSpanCreatedRef = useRef(onSpanCreated);
  const onConnectionChangeRef = useRef(onConnectionChange);
  const reconnectDelayRef = useRef(reconnectDelay);
  const maxReconnectAttemptsRef = useRef(maxReconnectAttempts);

  useEffect(() => {
    onTraceCreatedRef.current = onTraceCreated;
    onTraceUpdatedRef.current = onTraceUpdated;
    onSpanCreatedRef.current = onSpanCreated;
    onConnectionChangeRef.current = onConnectionChange;
    reconnectDelayRef.current = reconnectDelay;
    maxReconnectAttemptsRef.current = maxReconnectAttempts;
  }, [
    onTraceCreated,
    onTraceUpdated,
    onSpanCreated,
    onConnectionChange,
    reconnectDelay,
    maxReconnectAttempts,
  ]);

  /**
   * Clear any pending reconnect timeout
   */
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  /**
   * Handle incoming WebSocket message
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "connected":
          setClientId((data as { clientId: string }).clientId);
          break;

        case "trace:created": {
          const traceData = data as unknown as TraceCreatedEvent;
          onTraceCreatedRef.current?.(traceData.trace);
          break;
        }

        case "trace:updated": {
          const traceData = data as unknown as TraceUpdatedEvent;
          onTraceUpdatedRef.current?.(traceData.trace);
          break;
        }

        case "span:created": {
          const spanData = data as unknown as SpanCreatedEvent;
          onSpanCreatedRef.current?.(spanData);
          break;
        }

        case "ping":
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "pong" }));
          }
          break;

        case "error":
          console.error("[WebSocket] Server error:", data.message);
          break;
      }
    } catch (err) {
      console.error("[WebSocket] Error parsing message:", err);
    }
  }, []);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    // Don't connect if already connected or connecting
    if (wsRef.current?.readyState === WebSocket.OPEN || 
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    shouldReconnectRef.current = true;
    intentionalCloseRef.current = false;
    clearReconnectTimeout();

    try {
      // Determine WebSocket URL
      const protocol = typeof window !== "undefined" && window.location.protocol === "https:" 
        ? "wss:" 
        : "ws:";
      const host = typeof window !== "undefined" ? window.location.host : "localhost:3000";
      const wsUrl = `${protocol}//${host}/_ws`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        onConnectionChangeRef.current?.(true);
        console.log("[WebSocket] Connected to", wsUrl);
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        setIsConnected(false);
        setClientId(null);
        onConnectionChangeRef.current?.(false);
        console.log("[WebSocket] Disconnected:", event.code, event.reason);

        if (intentionalCloseRef.current) {
          return;
        }

        // Attempt reconnection if not intentional close
        if (shouldReconnectRef.current && reconnectAttemptsRef.current < maxReconnectAttemptsRef.current) {
          const delay = reconnectDelayRef.current * Math.pow(2, reconnectAttemptsRef.current);
          console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttemptsRef.current) {
          setError(new Error("Max reconnection attempts reached"));
        }
      };

      ws.onerror = (err) => {
        if (!intentionalCloseRef.current) {
          console.error("[WebSocket] Error:", err);
          setError(new Error("WebSocket connection error"));
        }
      };

      wsRef.current = ws;
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to connect"));
    }
  }, [handleMessage, clearReconnectTimeout]);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    intentionalCloseRef.current = true;
    clearReconnectTimeout();

    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;

      if (ws.readyState === WebSocket.CONNECTING) {
        // In React StrictMode dev cleanup can happen while CONNECTING.
        // Closing immediately produces noisy browser warnings.
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.onopen = () => {
          try {
            ws.close();
          } catch {
            // ignore
          }
        };
      } else {
        try {
          ws.close();
        } catch {
          // ignore
        }
      }
      wsRef.current = null;
    }

    setIsConnected(false);
    setClientId(null);
  }, [clearReconnectTimeout]);

  /**
   * Send a message to the server
   */
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  /**
   * Subscribe to all trace updates
   */
  const subscribeToTraces = useCallback(() => {
    sendMessage({ type: "subscribe:traces" });
  }, [sendMessage]);

  /**
   * Subscribe to a specific trace
   */
  const subscribeToTrace = useCallback(
    (traceId: string) => {
      sendMessage({ type: "subscribe:trace", traceId });
    },
    [sendMessage]
  );

  /**
   * Unsubscribe from a specific trace
   */
  const unsubscribeFromTrace = useCallback(
    (traceId: string) => {
      sendMessage({ type: "unsubscribe:trace", traceId });
    },
    [sendMessage]
  );

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    error,
    clientId,
    subscribeToTraces,
    subscribeToTrace,
    unsubscribeFromTrace,
    connect,
    disconnect,
  };
}

// ============================================================================
// Utility Hook - Simplified for common use case
// ============================================================================

/**
 * useTracesSubscription - Simplified hook for subscribing to all traces
 */
export function useTracesSubscription(
  callbacks?: {
    onTraceCreated?: UseTraceWebSocketOptions["onTraceCreated"];
    onTraceUpdated?: UseTraceWebSocketOptions["onTraceUpdated"];
  }
): { isConnected: boolean; error: Error | null } {
  const { isConnected, error, subscribeToTraces } = useTraceWebSocket({
    onTraceCreated: callbacks?.onTraceCreated,
    onTraceUpdated: callbacks?.onTraceUpdated,
  });

  // Auto-subscribe when connected
  useEffect(() => {
    if (isConnected) {
      subscribeToTraces();
    }
  }, [isConnected, subscribeToTraces]);

  return { isConnected, error };
}
