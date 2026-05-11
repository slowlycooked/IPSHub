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
    <aside className="w-[240px] border-r border-neutral bg-white/80 px-4 py-5">
      <div className="mb-6 px-2">
        <p className="text-xl font-semibold text-text">IPSHub</p>
        <p className="mt-1 text-sm text-slate-500">Subscription Aggregator</p>
      </div>
      <nav className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `block rounded-md px-3 py-2 text-sm font-medium ${
                isActive ? 'bg-primary text-white' : 'text-slate-700 hover:bg-slate-100'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
        <span className="mt-4 block cursor-not-allowed rounded-md px-3 py-2 text-sm text-slate-400">
          Settings (coming soon)
        </span>
      </nav>
    </aside>
  );
}
