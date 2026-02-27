import { useState } from 'react';
import { useGotionStore } from '@/app/store/gotionStore';

export function useSync() {
  const { settings, tasks, markSynced, addTask, updateTask } = useGotionStore();
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sync = async () => {
    // Mock sync for frontend-only demo
    setIsSyncing(true);
    setError(null);

    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 1. Mock Push dirty tasks
      const dirtyTasks = tasks.filter((t) => t.is_dirty);
      for (const task of dirtyTasks) {
        // Simulate successful push
        markSynced(task.id, `fake-notion-id-${task.id}`);
      }

      // 2. Mock Pull updates (Randomly update a task or add a new one occasionally)
      const shouldMockUpdate = Math.random() > 0.7;
      if (shouldMockUpdate) {
        // Mock a remote task
        const remoteTask = {
            id: 'fake-remote-id-' + Date.now(),
            properties: {
                Name: { title: [{ plain_text: 'New Remote Task ' + new Date().toLocaleTimeString() }] },
                Status: { status: { name: 'Not started' } }
            },
            created_time: new Date().toISOString(),
            last_edited_time: new Date().toISOString()
        };

        const newTask: import('@/app/store/gotionStore').Task = {
            id: crypto.randomUUID(),
            notion_id: remoteTask.id,
            title: remoteTask.properties.Name.title[0].plain_text,
            status: 'not-started',
            priority: 'none',
            created_at: new Date(remoteTask.created_time).getTime(),
            updated_at: new Date(remoteTask.last_edited_time).getTime(),
            title_updated_at: new Date(remoteTask.last_edited_time).getTime(),
            status_updated_at: new Date(remoteTask.last_edited_time).getTime(),
            priority_updated_at: new Date(remoteTask.last_edited_time).getTime(),
            is_dirty: false,
        };
        useGotionStore.getState().importTask(newTask);
      }

      useGotionStore.getState().setSettings({ lastSyncAt: Date.now() });

    } catch (err: any) {
      console.error('Sync failed:', err);
      setError(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  return { sync, isSyncing, error };
}
