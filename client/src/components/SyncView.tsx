import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import {
  ChevronLeft,
  Cloud,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Trash2,
  Play,
} from "lucide-react";
import { api } from "../lib/api";
import { useSettingsStore } from "../stores/settingsStore";
import type { SyncStatus } from "../hooks/useWebSocket";

interface SyncViewProps {
  onClose: () => void;
  syncStatus: SyncStatus;
}

export function SyncView({ onClose, syncStatus }: SyncViewProps) {
  // Server URL state
  const serverUrl = useSettingsStore((s) => s.serverUrl);
  const setServerUrl = useSettingsStore((s) => s.setServerUrl);
  const [localUrl, setLocalUrl] = useState(serverUrl);
  const [urlSaved, setUrlSaved] = useState(false);
  useEffect(() => { setLocalUrl(serverUrl); }, [serverUrl]);
  const urlChanged = localUrl.trim() !== serverUrl;

  // API Key state
  const apiKey = useSettingsStore((s) => s.apiKey);
  const setApiKey = useSettingsStore((s) => s.setApiKey);
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  useEffect(() => { setLocalApiKey(apiKey); }, [apiKey]);
  const handleSaveApiKey = () => {
    setApiKey(localApiKey);
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 2000);
  };

  const handleSaveUrl = () => {
    const trimmed = localUrl.trim();
    if (trimmed === serverUrl) return;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setLocalUrl(serverUrl);
        return;
      }
      setServerUrl(trimmed);
      setUrlSaved(true);
      setTimeout(() => setUrlSaved(false), 2000);
    } catch {
      setLocalUrl(serverUrl);
    }
  };

  // Notion config state
  const [notionToken, setNotionToken] = useState("");
  const [notionDbId, setNotionDbId] = useState("");
  const [notionTokenConfigured, setNotionTokenConfigured] = useState(false);
  const [notionTokenPreview, setNotionTokenPreview] = useState("");
  const [notionTestResult, setNotionTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [notionTesting, setNotionTesting] = useState(false);
  const [connSaving, setConnSaving] = useState(false);

  // Field mapping
  const [fieldMap, setFieldMap] = useState({
    title: "Name",
    status: "Status",
    due_date: "Due Date",
    status_todo: "To Do",
    status_done: "Done",
    category: "",
    starred: "",
    parent_item: "",
    status_type: "select",
  });
  const [schemaProps, setSchemaProps] = useState<{ name: string; property_type: string; options: string[] }[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [mappingSaving, setMappingSaving] = useState(false);
  const [mappingResult, setMappingResult] = useState<{ success: boolean; message: string } | null>(null);

  // Sync now
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    api.getNotionConfig().then((cfg) => {
      setNotionTokenConfigured(cfg.token_configured);
      setNotionTokenPreview(cfg.token_preview);
      setNotionDbId(cfg.database_id);
      if (cfg.field_map) setFieldMap(cfg.field_map);
    }).catch(() => {});
  }, []);

  const loadSchema = async () => {
    setSchemaLoading(true);
    try {
      const result = await api.getNotionSchema();
      if (result.success) {
        setSchemaProps(result.properties);
        const props = result.properties;
        const titleProp = props.find((p) => p.property_type === "title");
        const statusProp = props.find((p) => p.property_type === "select" || p.property_type === "status");
        const dateProp = props.find((p) => p.property_type === "date");

        const categoryPatterns = ["category", "type", "project", "tag", "label"];
        const categoryProp = props.find((p) =>
          (p.property_type === "select" || p.property_type === "multi_select") &&
          categoryPatterns.some((pat) => p.name.toLowerCase().includes(pat))
        );
        const starredPatterns = ["starred", "star", "important", "priority", "favorite"];
        const starredProp = props.find((p) =>
          p.property_type === "checkbox" &&
          starredPatterns.some((pat) => p.name.toLowerCase().includes(pat))
        );
        const parentPatterns = ["parent", "parent item"];
        const parentProp = props.find((p) =>
          p.property_type === "relation" &&
          parentPatterns.some((pat) => p.name.toLowerCase().includes(pat))
        );

        const statusOpts = statusProp?.options ?? [];
        const donePatterns = ["done", "complete", "completed", "finished", "closed"];
        const guessedDone = statusOpts.find((o) =>
          donePatterns.some((p) => o.toLowerCase().includes(p))
        );
        const guessedTodo = guessedDone
          ? statusOpts.find((o) => o !== guessedDone) ?? statusOpts[0]
          : undefined;

        setFieldMap((prev) => ({
          ...prev,
          ...(titleProp ? { title: titleProp.name } : {}),
          ...(statusProp ? { status: statusProp.name, status_type: statusProp.property_type } : {}),
          ...(dateProp ? { due_date: dateProp.name } : {}),
          ...(guessedDone ? { status_done: guessedDone } : {}),
          ...(guessedTodo ? { status_todo: guessedTodo } : {}),
          ...(categoryProp ? { category: categoryProp.name } : {}),
          ...(starredProp ? { starred: starredProp.name } : {}),
          ...(parentProp ? { parent_item: parentProp.name } : {}),
        }));
      }
    } catch {}
    setSchemaLoading(false);
  };

  // Save connection only (token + database_id)
  const handleConnSave = async () => {
    setConnSaving(true);
    setNotionTestResult(null);
    try {
      const updates: { token?: string; database_id?: string } = {};
      if (notionToken.trim()) updates.token = notionToken.trim();
      if (notionDbId.trim()) updates.database_id = notionDbId.trim();
      await api.updateNotionConfig(updates);
      const cfg = await api.getNotionConfig();
      setNotionTokenConfigured(cfg.token_configured);
      setNotionTokenPreview(cfg.token_preview);
      setNotionDbId(cfg.database_id);
      setNotionToken("");
      setNotionTestResult({ success: true, message: "Connection saved" });
    } catch (e) {
      setNotionTestResult({ success: false, message: "Failed to save" });
    } finally {
      setConnSaving(false);
    }
  };

  // Save field mapping only
  const handleMappingSave = async () => {
    setMappingSaving(true);
    setMappingResult(null);
    try {
      await api.updateNotionConfig({ field_map: fieldMap });
      setMappingResult({ success: true, message: "Field mapping saved" });
    } catch {
      setMappingResult({ success: false, message: "Failed to save" });
    } finally {
      setMappingSaving(false);
    }
  };

  const handleNotionTest = async () => {
    setNotionTesting(true);
    setNotionTestResult(null);
    try {
      const result = await api.testNotionConnection({
        token: notionToken.trim() || undefined,
        database_id: notionDbId.trim() || undefined,
      });
      setNotionTestResult(result);
    } catch {
      setNotionTestResult({ success: false, message: "Failed to reach server" });
    } finally {
      setNotionTesting(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await api.syncNow();
      setSyncResult(result);
    } catch {
      setSyncResult({ success: false, message: "Sync failed" });
    } finally {
      setSyncing(false);
    }
  };

  const statusOptions = useMemo(() => {
    const statusProp = schemaProps.find((p) => p.name === fieldMap.status);
    return statusProp?.options ?? [];
  }, [schemaProps, fieldMap.status]);

  return (
    <motion.div
      className="absolute inset-0 bg-[#F5F6F8] z-50 flex flex-col"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <ChevronLeft size={22} className="text-gray-700" />
        </button>
        <h1 className="text-lg font-semibold text-gray-800">Notion Sync</h1>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Server group */}
        <div className="text-sm text-gray-500 mb-2">Server</div>
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm mb-6">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-gray-500">Server URL</label>
              <span className="flex items-center gap-1 text-[11px]">
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${
                    syncStatus === "connected"
                      ? "bg-green-400"
                      : syncStatus === "connecting"
                        ? "bg-yellow-400 animate-pulse"
                        : "bg-gray-400"
                  }`}
                />
                <span className={
                  syncStatus === "connected"
                    ? "text-green-500"
                    : syncStatus === "connecting"
                      ? "text-yellow-500"
                      : "text-gray-400"
                }>
                  {syncStatus === "connected"
                    ? "Connected"
                    : syncStatus === "connecting"
                      ? "Connecting..."
                      : "Offline"}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={localUrl}
                onChange={(e) => { setLocalUrl(e.target.value); setUrlSaved(false); }}
                onKeyDown={(e) => e.key === "Enter" && handleSaveUrl()}
                className="flex-1 text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2 outline-none"
                placeholder="http://localhost:3001"
              />
              <button
                onClick={handleSaveUrl}
                disabled={!urlChanged}
                className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                  urlSaved
                    ? "bg-green-50 text-green-600"
                    : urlChanged
                      ? "bg-red-500 text-white hover:bg-red-600"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {urlSaved ? "✓" : "Save"}
              </button>
            </div>
          </div>
        </div>

        {/* API Key group */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm mb-6">
          <div className="px-4 py-3">
            <label className="text-sm text-gray-500 mb-1 block">API Key</label>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={localApiKey}
                onChange={(e) => { setLocalApiKey(e.target.value); setApiKeySaved(false); }}
                onKeyDown={(e) => e.key === "Enter" && handleSaveApiKey()}
                className="flex-1 text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2 outline-none"
                placeholder="Enter API key (optional)"
              />
              <button
                onClick={handleSaveApiKey}
                disabled={localApiKey === apiKey}
                className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                  apiKeySaved
                    ? "bg-green-50 text-green-600"
                    : localApiKey !== apiKey
                      ? "bg-red-500 text-white hover:bg-red-600"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {apiKeySaved ? "✓" : "Save"}
              </button>
            </div>
          </div>
        </div>

        {/* Connection group */}
        <div className="text-sm text-gray-500 mb-2">Notion</div>
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          {/* Token */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-gray-500">Integration Token</label>
              {notionTokenConfigured && (
                <span className="text-xs text-green-500">Configured</span>
              )}
            </div>
            {notionTokenConfigured && !notionToken && (
              <div className="text-xs text-gray-400 mb-1 font-mono">
                {notionTokenPreview}
              </div>
            )}
            <input
              type="password"
              value={notionToken}
              onChange={(e) => setNotionToken(e.target.value)}
              className="w-full text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2 outline-none"
              placeholder={notionTokenConfigured ? "Enter new token to update" : "ntn_xxxxxxxxxxxxx"}
            />
          </div>

          {/* Database ID */}
          <div className="px-4 py-3 border-b border-gray-100">
            <label className="text-sm text-gray-500 mb-1 block">
              Database ID
            </label>
            <input
              type="text"
              value={notionDbId}
              onChange={(e) => setNotionDbId(e.target.value)}
              className="w-full text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2 outline-none font-mono"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </div>

          {/* Save + Test buttons */}
          <div className="px-4 py-3 flex items-center gap-3">
            <button
              onClick={handleConnSave}
              disabled={connSaving}
              className="flex-1 bg-red-500 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {connSaving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={handleNotionTest}
              disabled={notionTesting}
              className="flex-1 bg-gray-100 text-gray-700 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {notionTesting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Cloud size={16} />
              )}
              {notionTesting ? "Testing..." : "Test"}
            </button>
          </div>

          {/* Test/Save result */}
          {notionTestResult && (
            <div
              className={`mx-4 mb-3 px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                notionTestResult.success
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {notionTestResult.success ? (
                <CheckCircle2 size={16} />
              ) : (
                <XCircle size={16} />
              )}
              {notionTestResult.message}
            </div>
          )}
        </div>

        {/* Field Mapping group */}
        <div className="text-sm text-gray-500 mt-6 mb-2 flex items-center justify-between">
          <span>Field Mapping</span>
          <button
            onClick={loadSchema}
            disabled={schemaLoading}
            className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
          >
            <RefreshCw size={12} className={schemaLoading ? "animate-spin" : ""} />
            {schemaLoading ? "Loading..." : "Load Schema"}
          </button>
        </div>
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <FieldMapRow
            label="Title Property"
            value={fieldMap.title}
            onChange={(v) => setFieldMap({ ...fieldMap, title: v })}
            options={schemaProps.filter((p) => p.property_type === "title")}
          />
          <FieldMapRow
            label="Status Property"
            value={fieldMap.status}
            onChange={(v) => {
              const prop = schemaProps.find((p) => p.name === v);
              setFieldMap({ ...fieldMap, status: v, status_type: prop?.property_type ?? "select" });
            }}
            options={schemaProps.filter((p) => p.property_type === "select" || p.property_type === "status")}
          />
          <FieldMapRow
            label="Due Date Property"
            value={fieldMap.due_date}
            onChange={(v) => setFieldMap({ ...fieldMap, due_date: v })}
            options={schemaProps.filter((p) => p.property_type === "date")}
          />
          <FieldMapRow
            label="Category Property"
            value={fieldMap.category}
            onChange={(v) => setFieldMap({ ...fieldMap, category: v })}
            options={schemaProps.filter((p) => p.property_type === "select" || p.property_type === "multi_select")}
            placeholder="(not mapped)"
            allowEmpty
          />
          <FieldMapRow
            label="Starred Property"
            value={fieldMap.starred}
            onChange={(v) => setFieldMap({ ...fieldMap, starred: v })}
            options={schemaProps.filter((p) => p.property_type === "checkbox")}
            placeholder="(not mapped)"
            allowEmpty
          />
          <FieldMapRow
            label="Parent Item (Sub-tasks)"
            value={fieldMap.parent_item}
            onChange={(v) => setFieldMap({ ...fieldMap, parent_item: v })}
            options={schemaProps.filter((p) => p.property_type === "relation")}
            placeholder="(not mapped)"
            allowEmpty
          />
          <StatusValueRow
            label='Click ○ = Done, mapped to'
            value={fieldMap.status_done}
            onChange={(v) => {
              const autoTodo = statusOptions.find((o) => o !== v) ?? fieldMap.status_todo;
              setFieldMap({ ...fieldMap, status_done: v, status_todo: autoTodo });
            }}
            options={statusOptions}
          />

          {/* Save mapping button */}
          <div className="px-4 py-3 border-t border-gray-100">
            <button
              onClick={handleMappingSave}
              disabled={mappingSaving}
              className="w-full bg-red-500 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {mappingSaving ? "Saving..." : "Save Mapping"}
            </button>
          </div>

          {/* Mapping result */}
          {mappingResult && (
            <div
              className={`mx-4 mb-3 px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                mappingResult.success
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {mappingResult.success ? (
                <CheckCircle2 size={16} />
              ) : (
                <XCircle size={16} />
              )}
              {mappingResult.message}
            </div>
          )}
        </div>

        {/* Sync Actions group */}
        <div className="text-sm text-gray-500 mt-6 mb-2">Actions</div>
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm mb-24">
          {/* Sync Now */}
          <div className="px-4 py-3 border-b border-gray-100">
            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className="w-full bg-blue-500 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {syncing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Play size={16} />
              )}
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
          </div>

          {/* Sync result */}
          {syncResult && (
            <div
              className={`mx-4 my-3 px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                syncResult.success
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {syncResult.success ? (
                <CheckCircle2 size={16} />
              ) : (
                <XCircle size={16} />
              )}
              {syncResult.message}
            </div>
          )}

          {/* Cleanup */}
          <div className="px-4 py-3">
            <button
              onClick={async () => {
                const result = await api.cleanupEmptyTasks();
                setSyncResult({
                  success: true,
                  message: `Cleaned up ${result.deleted} empty tasks`,
                });
              }}
              className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-red-500 py-2 transition-colors"
            >
              <Trash2 size={14} />
              Clean Empty Tasks
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FieldMapRow({
  label,
  value,
  onChange,
  options,
  placeholder,
  allowEmpty,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { name: string; property_type: string; options: string[] }[];
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  return (
    <div className="px-4 py-3 border-b border-gray-100">
      <label className="text-sm text-gray-500 mb-1 block">{label}</label>
      {options.length > 0 ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2 outline-none"
        >
          {allowEmpty && <option value="">{placeholder ?? "(none)"}</option>}
          {!allowEmpty && !options.some((o) => o.name === value) && value && (
            <option value={value}>{value}</option>
          )}
          {options.map((o) => (
            <option key={o.name} value={o.name}>
              {o.name} ({o.property_type})
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2 outline-none"
          placeholder={placeholder ?? label}
        />
      )}
    </div>
  );
}

function StatusValueRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="px-4 py-3 border-b border-gray-100">
      <label className="text-sm text-gray-500 mb-1 block">{label}</label>
      {options.length > 0 ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2 outline-none"
        >
          {!options.includes(value) && (
            <option value={value}>{value}</option>
          )}
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2 outline-none"
          placeholder={label}
        />
      )}
    </div>
  );
}
