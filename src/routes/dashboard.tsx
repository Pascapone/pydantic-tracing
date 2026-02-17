import { createFileRoute } from "@tanstack/react-router";
import { authMiddleware } from "@/lib/middleware";
import { useSession, signOut } from "@/lib/auth-client";
import { getAbilitiesForUser, parseRoles, type AppUser } from "@/lib/abilities";
import {
  Shield,
  User,
  Users,
  Settings,
  LogOut,
  Crown,
  BarChart3,
  Activity,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  server: {
    middleware: [authMiddleware],
  },
});

function DashboardPage() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-cyan-400" />
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  const rawRole = (session.user as { role?: string }).role || "user";
  const roles = parseRoles(rawRole);
  const appUser: AppUser = {
    id: session.user.id,
    role: rawRole,
    roles,
  };

  const abilities = getAbilitiesForUser(appUser);
  const isAdmin = roles.includes("admin");

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Dashboard Header */}
      <div className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isAdmin ? (
              <Crown size={24} className="text-amber-400" />
            ) : (
              <User size={24} className="text-cyan-400" />
            )}
            <div>
              <h1 className="text-xl font-bold text-white">
                {isAdmin ? "Admin Dashboard" : "Dashboard"}
              </h1>
              <p className="text-sm text-gray-400">
                Welcome, {session.user.name || session.user.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              {roles.map((r) => (
                <span
                  key={r}
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    r === "admin"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                  }`}
                >
                  {r.toUpperCase()}
                </span>
              ))}
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<User size={20} />}
            label="Profile"
            value={session.user.name || "—"}
            color="cyan"
          />
          <StatCard
            icon={<Activity size={20} />}
            label="Status"
            value="Active"
            color="green"
          />
          {isAdmin && (
            <>
              <StatCard
                icon={<Users size={20} />}
                label="User Management"
                value="Available"
                color="amber"
              />
              <StatCard
                icon={<BarChart3 size={20} />}
                label="Analytics"
                value="Full Access"
                color="purple"
              />
            </>
          )}
        </div>

        {/* Role-specific panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Common: User Profile Panel */}
          {abilities.can("view", "Dashboard") && (
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <User size={20} className="text-cyan-400" />
                <h2 className="text-lg font-semibold text-white">
                  Your Profile
                </h2>
              </div>
              <div className="space-y-3">
                <InfoRow label="Name" value={session.user.name || "—"} />
                <InfoRow label="Email" value={session.user.email} />
                <InfoRow label="Roles" value={roles.join(", ")} />
                <InfoRow
                  label="Email Verified"
                  value={session.user.emailVerified ? "Yes" : "No"}
                />
              </div>
            </div>
          )}

          {/* Common: Settings Panel */}
          {abilities.can("view", "Settings") && (
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Settings size={20} className="text-cyan-400" />
                <h2 className="text-lg font-semibold text-white">Settings</h2>
              </div>
              <p className="text-gray-400 text-sm">
                {abilities.can("manage", "Settings")
                  ? "You have full access to all settings."
                  : "You can view and update your personal settings."}
              </p>
              <div className="mt-4 space-y-2">
                <SettingToggle label="Email Notifications" defaultOn />
                <SettingToggle label="Dark Mode" defaultOn />
                {abilities.can("manage", "Settings") && (
                  <SettingToggle label="System Maintenance Mode" />
                )}
              </div>
            </div>
          )}

          {/* Admin-only: User Management Panel */}
          {abilities.can("view", "UserList") && (
            <div className="bg-slate-800/50 backdrop-blur-sm border border-amber-500/30 rounded-xl p-6 lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Shield size={20} className="text-amber-400" />
                <h2 className="text-lg font-semibold text-white">
                  Admin: User Management
                </h2>
                <span className="ml-auto px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400">
                  Admin Only
                </span>
              </div>
              <p className="text-gray-400 text-sm mb-4">
                Manage users, assign roles, ban/unban accounts, and view
                sessions.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <AdminAction icon={<Users size={16} />} label="List Users" />
                <AdminAction icon={<Crown size={16} />} label="Set Roles" />
                <AdminAction icon={<Shield size={16} />} label="Ban/Unban" />
                <AdminAction
                  icon={<Activity size={16} />}
                  label="View Sessions"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
    green: "text-green-400 bg-green-500/10 border-green-500/30",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/30",
  };

  return (
    <div
      className={`rounded-xl border p-4 ${colorClasses[color] || colorClasses.cyan}`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm text-white font-medium">{value}</span>
    </div>
  );
}

function SettingToggle({
  label,
  defaultOn = false,
}: {
  label: string;
  defaultOn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-300">{label}</span>
      <div
        className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${
          defaultOn ? "bg-cyan-500" : "bg-slate-600"
        }`}
      >
        <div
          className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-transform ${
            defaultOn ? "translate-x-5.5" : "translate-x-0.5"
          }`}
        />
      </div>
    </div>
  );
}

function AdminAction({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-2 p-3 rounded-lg bg-slate-900/50 border border-slate-600 hover:border-amber-500/50 hover:bg-slate-700/50 transition-all text-sm text-gray-300 hover:text-white"
    >
      {icon}
      {label}
    </button>
  );
}
