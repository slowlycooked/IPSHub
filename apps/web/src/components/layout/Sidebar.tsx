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
    <>
      {/* Mobile top bar (< md) */}
      <div className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center border-b border-white/10 bg-primary px-4 md:hidden">
        <span className="font-display text-lg font-bold tracking-wide text-white mr-6">IPSHub</span>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `shrink-0 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-accent text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Desktop sidebar (md+) */}
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:w-64 md:flex md:flex-col bg-primary">
        {/* Logo */}
        <div className="px-6 py-7 border-b border-white/10">
          <p className="font-mono text-xs uppercase tracking-widest text-white/40">Control Plane</p>
          <h1 className="mt-1.5 font-display text-2xl font-bold tracking-wide text-white">IPSHub</h1>
          <p className="mt-1.5 text-xs text-white/50 leading-relaxed">Proxy Subscription Hub</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer status */}
        <div className="px-6 py-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-success"></span>
            <span className="text-xs text-white/40">System Online</span>
          </div>
        </div>
      </aside>
    </>
  );
}
