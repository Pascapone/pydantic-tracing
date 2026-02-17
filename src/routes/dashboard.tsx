import { createFileRoute } from "@tanstack/react-router";
import { authMiddleware } from "@/lib/middleware";
import { useSession, signOut } from "@/lib/auth-client";
import { getAbilitiesForUser, parseRoles, type AppUser } from "@/lib/abilities";
import { useTheme } from "@/components/theme-provider";
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
      <div className="min-h-screen bg-gray-50 dark:bg-gradient-to-b dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center transition-colors duration-300">
        <Loader2 size={40} className="animate-spin text-cyan-600 dark:text-cyan-400" />
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
    <div className="min-h-screen bg-gray-50 dark:bg-gradient-to-b dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-300">
      {/* Dashboard Header */}
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isAdmin ? (
              <Crown size={24} className="text-amber-500 dark:text-amber-400" />
            ) : (
              <User size={24} className="text-cyan-600 dark:text-cyan-400" />
            )}
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {isAdmin ? "Admin Dashboard" : "Dashboard"}
              </h1>
              <p className="text-sm text-slate-500 dark:text-gray-400">
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
                      ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30 border"
                      : "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-400 dark:border-cyan-500/30 border"
                  }`}
                >
                  {r.toUpperCase()}
                </span>
              ))}
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all"
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
            <div className="bg-white dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm dark:shadow-none">
              <div className="flex items-center gap-2 mb-4">
                <User size={20} className="text-cyan-600 dark:text-cyan-400" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
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
            <div className="bg-white dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm dark:shadow-none">
              <div className="flex items-center gap-2 mb-4">
                <Settings size={20} className="text-cyan-600 dark:text-cyan-400" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Settings</h2>
              </div>
              <p className="text-slate-500 dark:text-gray-400 text-sm">
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
            <div className="bg-white dark:bg-slate-800/50 backdrop-blur-sm border border-amber-200 dark:border-amber-500/30 rounded-xl p-6 lg:col-span-2 shadow-sm dark:shadow-none">
              <div className="flex items-center gap-2 mb-4">
                <Shield size={20} className="text-amber-500 dark:text-amber-400" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Admin: User Management
                </h2>
                <span className="ml-auto px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 dark:border-transparent">
                  Admin Only
                </span>
              </div>
              <p className="text-slate-500 dark:text-gray-400 text-sm mb-4">
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
    cyan: "text-cyan-600 bg-cyan-50 border-cyan-200 dark:text-cyan-400 dark:bg-cyan-500/10 dark:border-cyan-500/30",
    green: "text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-500/10 dark:border-green-500/30",
    amber: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/30",
    purple: "text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-500/10 dark:border-purple-500/30",
  };

  return (
    <div
      className={`rounded-xl border p-4 shadow-sm dark:shadow-none ${colorClasses[color] || colorClasses.cyan}`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm opacity-80">{label}</span>
      </div>
      <p className="text-lg font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-700 last:border-0">
      <span className="text-sm text-slate-500 dark:text-gray-400">{label}</span>
      <span className="text-sm text-slate-900 dark:text-white font-medium">{value}</span>
    </div>
  );
}

function SettingToggle({
  label,
  defaultOn = false, // Kept for other toggles using this
}: {
  label: string;
  defaultOn?: boolean;
}) {
  const { theme, setTheme } = useTheme();
  
  // If explicitly "Dark Mode" toggle, we hijack the state
  const isDarkToggle = label === "Dark Mode";
  const isOn = isDarkToggle ? theme === "dark" : defaultOn;

  const handleToggle = () => {
    if (isDarkToggle) {
      setTheme(theme === "dark" ? "light" : "dark");
    }
  };

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-slate-600 dark:text-gray-300">{label}</span>
      <div
        onClick={handleToggle}
        className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${
          isOn ? "bg-cyan-600 dark:bg-cyan-500" : "bg-slate-300 dark:bg-slate-600"
        }`}
      >
        <div
          className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-transform ${
            isOn ? "translate-x-5.5" : "translate-x-0.5"
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
      className="flex items-center gap-2 p-3 rounded-lg bg-slate-100 border border-slate-200 hover:bg-slate-200 hover:border-amber-300 dark:bg-slate-900/50 dark:border-slate-600 dark:hover:border-amber-500/50 dark:hover:bg-slate-700/50 transition-all text-sm text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white"
    >
      {icon}
      {label}
    </button>
  );
}
