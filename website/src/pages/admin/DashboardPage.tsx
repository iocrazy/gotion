import { useEffect, useState } from "react";
import { Users, Crown, CircleDollarSign, CheckSquare } from "lucide-react";
import { getStats, getUsers, type Stats, type User } from "../../lib/api";
import { format } from "date-fns";

interface StatCardProps {
  readonly icon: React.ElementType;
  readonly label: string;
  readonly value: string;
  readonly color: string;
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [statsData, usersData] = await Promise.all([
          getStats(),
          getUsers(),
        ]);
        setStats(statsData);
        setUsers(usersData.slice(0, 5));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      }
    }
    void load();
  }, []);

  if (error) {
    return (
      <div className="px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-6">Dashboard</h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Users}
          label="Total Users"
          value={stats?.total_users?.toString() ?? "-"}
          color="bg-blue-500"
        />
        <StatCard
          icon={Crown}
          label="Pro Users"
          value={stats?.pro_users?.toString() ?? "-"}
          color="bg-amber-500"
        />
        <StatCard
          icon={CircleDollarSign}
          label="Monthly Revenue"
          value={stats ? `¥${stats.monthly_revenue.toFixed(2)}` : "-"}
          color="bg-green-500"
        />
        <StatCard
          icon={CheckSquare}
          label="Total Tasks"
          value={stats?.total_tasks?.toString() ?? "-"}
          color="bg-red-500"
        />
      </div>

      {/* Recent Users */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Recent Users</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-6 py-3 font-medium">Username</th>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Role</th>
                <th className="px-6 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">
                    {u.username}
                  </td>
                  <td className="px-6 py-3 text-gray-600">{u.email}</td>
                  <td className="px-6 py-3">
                    {u.is_admin ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                        Admin
                      </span>
                    ) : (
                      <span className="text-gray-500">User</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-gray-500">
                    {u.created_at
                      ? format(new Date(u.created_at), "yyyy-MM-dd")
                      : "-"}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-gray-400"
                  >
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
