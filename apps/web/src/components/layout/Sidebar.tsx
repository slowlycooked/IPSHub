import { NavLink } from 'react-router-dom';

const items = [
  { label: 'Dashboard', to: '/' },
  { label: 'Providers', to: '/providers' },
  { label: 'Nodes', to: '/nodes' },
  { label: 'Profiles', to: '/profiles' },
  { label: 'Logs', to: '/logs' },
];

export function Sidebar() {
  return (
    <aside className="border-b border-line/70 bg-panel/80 px-4 py-4 backdrop-blur lg:fixed lg:inset-y-0 lg:left-0 lg:w-[288px] lg:border-b-0 lg:border-r">
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-text-dim">Control Plane</p>
        <p className="mt-3 text-2xl font-semibold text-text">IPSHub</p>
        <p className="mt-2 text-sm text-text-muted">Secure subscription aggregation for self-hosted proxy fleets.</p>
      </div>
      <nav className="flex gap-2 overflow-x-auto lg:block lg:space-y-2 lg:overflow-visible">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `block shrink-0 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                isActive
                  ? 'bg-[linear-gradient(135deg,rgba(61,118,255,0.9),rgba(31,75,172,0.95))] text-white shadow-[0_12px_30px_rgba(20,63,165,0.45)]'
                  : 'text-text-muted hover:bg-white/[0.06] hover:text-text'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
        <span className="mt-0 block shrink-0 cursor-not-allowed rounded-2xl px-4 py-3 text-sm text-text-dim lg:mt-4">
          Settings (coming soon)
        </span>
      </nav>
    </aside>
  );
}
