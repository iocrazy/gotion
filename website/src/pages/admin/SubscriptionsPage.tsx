import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { getSubscriptions, giftPro, type Subscription } from "../../lib/api";
import { format } from "date-fns";

export function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      const data = await getSubscriptions();
      setSubscriptions(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load subscriptions"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleGiftPro(sub: Subscription) {
    const input = window.prompt(
      `Gift Pro days to ${sub.email ?? sub.user_id}:`,
      "30"
    );
    if (!input) return;

    const days = parseInt(input, 10);
    if (isNaN(days) || days <= 0) {
      setError("Please enter a valid number of days");
      return;
    }

    try {
      await giftPro(sub.user_id, days);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to gift Pro");
    }
  }

  function formatExpiry(expiresAt: string | null): string {
    if (!expiresAt) return "Never";
    return format(new Date(expiresAt), "yyyy-MM-dd HH:mm");
  }

  function getPlanBadge(plan: string) {
    if (plan === "pro") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
          Pro
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        {plan}
      </span>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-6">Subscriptions</h2>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="px-6 py-3 font-medium">User</th>
                <th className="px-6 py-3 font-medium">Plan</th>
                <th className="px-6 py-3 font-medium">Period</th>
                <th className="px-6 py-3 font-medium">Expires</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-gray-400"
                  >
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && subscriptions.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-gray-400"
                  >
                    No subscriptions found
                  </td>
                </tr>
              )}
              {subscriptions.map((sub) => (
                <tr key={sub.user_id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <div>
                      <div className="font-medium text-gray-900">
                        {sub.username ?? sub.user_id}
                      </div>
                      {sub.email && (
                        <div className="text-xs text-gray-500">
                          {sub.email}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3">{getPlanBadge(sub.plan)}</td>
                  <td className="px-6 py-3 text-gray-600">
                    {sub.period ?? "-"}
                  </td>
                  <td className="px-6 py-3 text-gray-600">
                    {formatExpiry(sub.expires_at)}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex justify-end">
                      <button
                        onClick={() => void handleGiftPro(sub)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                      >
                        <Gift className="w-3.5 h-3.5" />
                        Gift Pro
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
