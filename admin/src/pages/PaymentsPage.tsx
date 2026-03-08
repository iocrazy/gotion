import { useEffect, useState } from "react";
import { getPayments, type Payment } from "../lib/api";
import { format } from "date-fns";

export function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await getPayments();
        setPayments(data);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load payments"
        );
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  function formatAmount(amount: number): string {
    return `¥${amount.toFixed(2)}`;
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "paid":
      case "success":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
            {status}
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">
            {status}
          </span>
        );
      case "failed":
      case "refunded":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            {status}
          </span>
        );
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-6">Payments</h2>

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
                <th className="px-6 py-3 font-medium">Order No.</th>
                <th className="px-6 py-3 font-medium">Amount</th>
                <th className="px-6 py-3 font-medium">Channel</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Plan</th>
                <th className="px-6 py-3 font-medium">Paid At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-gray-400"
                  >
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && payments.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-gray-400"
                  >
                    No payments found
                  </td>
                </tr>
              )}
              {payments.map((p) => (
                <tr key={p.order_no} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-mono text-xs text-gray-900">
                    {p.order_no}
                  </td>
                  <td className="px-6 py-3 font-medium text-gray-900">
                    {formatAmount(p.amount)}
                  </td>
                  <td className="px-6 py-3 text-gray-600">{p.channel}</td>
                  <td className="px-6 py-3">{getStatusBadge(p.status)}</td>
                  <td className="px-6 py-3 text-gray-600">{p.plan}</td>
                  <td className="px-6 py-3 text-gray-500">
                    {p.paid_at
                      ? format(new Date(p.paid_at), "yyyy-MM-dd HH:mm")
                      : "-"}
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
