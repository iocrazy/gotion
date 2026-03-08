import { useEffect, useRef, useState } from "react";
import { useTaskStore } from "../stores/taskStore";
import { useCategoryStore } from "../stores/categoryStore";
import { useSettingsStore } from "../stores/settingsStore";
import { isTauri, tauriInvoke } from "../lib/tauri";
import { api } from "../lib/api";

export type SyncStatus = "connected" | "disconnected" | "connecting";

async function flushOfflineQueue() {
  if (!isTauri()) return;
  try {
    const queueJson = await tauriInvoke<string>("get_offline_queue");
    const ops = JSON.parse(queueJson) as Array<{
      id: number;
      entity_type: string;
      entity_id: string;
      action: string;
      payload: string;
    }>;

    if (ops.length === 0) return;

    let maxId = 0;
    for (const op of ops) {
      maxId = Math.max(maxId, op.id);
      const payload = JSON.parse(op.payload);
      try {
        if (op.action === "create" && op.entity_type === "task") {
          await api.createTask(payload);
        } else if (op.action === "update" && op.entity_type === "task") {
          await api.updateTask(op.entity_id, payload);
        } else if (op.action === "delete" && op.entity_type === "task") {
          await api.deleteTask(op.entity_id);
        }
      } catch (e) {
        console.error(`Failed to replay op ${op.id}:`, e);
      }
    }

    await tauriInvoke("clear_offline_queue", { upToId: maxId });
  } catch (e) {
    console.error("Failed to flush offline queue:", e);
  }
}

export function useWebSocket(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasDisconnectedRef = useRef(false);
  const { upsertTask, removeTask } = useTaskStore();
  const { upsertCategory, removeCategory } = useCategoryStore();
  const serverUrl = useSettingsStore((s) => s.serverUrl);
  const apiKey = useSettingsStore((s) => s.apiKey);

  useEffect(() => {
    let disposed = false;

    function connect() {
      if (disposed) return;
      setStatus("connecting");

      let wsUrl = serverUrl.replace(/^http/, "ws") + "/ws";
      if (apiKey) wsUrl += `?api_key=${encodeURIComponent(apiKey)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        if (wasDisconnectedRef.current) {
          flushOfflineQueue().then(() => {
            useTaskStore.getState().fetchTasks();
          });
        }
        wasDisconnectedRef.current = false;
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
            case "category_created":
              upsertCategory(msg.data);
              break;
            case "category_updated":
              upsertCategory(msg.data);
              break;
            case "category_deleted":
              removeCategory(msg.data.id);
              break;
            case "blocks_updated":
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
        wasDisconnectedRef.current = true;
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
  }, [upsertTask, removeTask, upsertCategory, removeCategory, serverUrl, apiKey]);

  return status;
}
