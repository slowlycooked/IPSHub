import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(7,44,44,0.06),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(255,95,3,0.08),transparent_28%)]" />
      <Card className="relative w-full max-w-md p-8 shadow-lg">
        <div className="mb-8 text-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-text-dim">Secure Control Plane</p>
          <h1 className="mb-2 mt-3 font-display text-4xl font-semibold tracking-wide text-primary">IPSHub</h1>
          <p className="text-sm text-text-muted">Sign in to manage providers, nodes, profiles and refresh jobs.</p>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="username" className="mb-2 block text-sm font-medium text-text-muted">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="ip-input"
              placeholder="Enter username"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-text-muted">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="ip-input"
              placeholder="Enter password"
              disabled={loading}
            />
          </div>

          <Button type="submit" variant="primary" className="w-full" isLoading={loading}>
            Sign In
          </Button>
        </form>

        <div className="mt-6 border-t border-line pt-5 text-center text-xs text-text-dim">Use the configured admin credentials from your environment.</div>
      </Card>
    </div>
  );
}
