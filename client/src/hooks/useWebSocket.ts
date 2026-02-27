import { useEffect, useRef, useState } from "react";
import { useTaskStore } from "../stores/taskStore";

const WS_URL = "ws://localhost:3001/ws";

export type SyncStatus = "connected" | "disconnected" | "connecting";

export function useWebSocket(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const { upsertTask, removeTask } = useTaskStore();

  useEffect(() => {
    let disposed = false;

    function connect() {
      if (disposed) return;
      setStatus("connecting");

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);
        ws.addEventListener("close", () => clearInterval(pingInterval), {
          once: true,
        });
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case "task_created":
              upsertTask(msg.data);
              break;
            case "task_updated":
              upsertTask(msg.data);
              break;
            case "task_deleted":
              removeTask(msg.data.id);
              break;
            case "blocks_updated":
              // Could trigger a reload for the selected task
              break;
            case "pong":
              break;
          }
        } catch (e) {
          console.error("Failed to parse WS message:", e);
        }
      };

      ws.onclose = () => {
        setStatus("disconnected");
        if (!disposed) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      disposed = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [upsertTask, removeTask]);

  return status;
}
