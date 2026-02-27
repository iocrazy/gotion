import { useState } from 'react';
import { useGotionStore } from '@/app/store/gotionStore';
import * as Dialog from '@radix-ui/react-dialog';
import { Settings as SettingsIcon, X } from 'lucide-react';

export function Settings() {
  const { settings, setSettings } = useGotionStore();
  const [token, setToken] = useState(settings.notionToken);
  const [dbId, setDbId] = useState(settings.notionDatabaseId);
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    setSettings({ notionToken: token, notionDatabaseId: dbId });
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/60 hover:text-white">
          <SettingsIcon className="w-5 h-5" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[450px] translate-x-[-50%] translate-y-[-50%] rounded-xl bg-zinc-900 border border-white/10 p-6 shadow-2xl focus:outline-none z-50 text-white">
          <div className="flex justify-between items-center mb-4">
            <Dialog.Title className="text-lg font-semibold">Settings</Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/60">Notion Integration Token</label>
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                placeholder="secret_..."
                type="password"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/60">Database ID</label>
              <input
                value={dbId}
                onChange={(e) => setDbId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                placeholder="32 chars..."
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSave}
              className="bg-white text-black hover:bg-white/90 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Save Changes
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
