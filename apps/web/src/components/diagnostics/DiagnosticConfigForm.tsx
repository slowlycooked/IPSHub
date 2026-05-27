import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import type { Provider } from '@/types/provider';
import { diagnosticsApi } from '@/api/diagnostics';

interface Props {
  providers: Provider[];
  isLoading: boolean;
  onSubmit: (cfg: {
    providerIds: string[];
    timeoutMs: number;
    concurrency: number;
    testUrls: string[];
  }) => void;
}

const TEST_URL_OPTIONS = [
  'http://www.gstatic.com/generate_204',
  'http://cp.cloudflare.com/generate_204',
  'https://www.apple.com/library/test/success.html',
];

export function DiagnosticConfigForm({ providers, isLoading, onSubmit }: Props) {
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [timeoutMs, setTimeoutMs] = useState(5000);
  const [concurrency, setConcurrency] = useState(3);
  const [testUrls] = useState<string[]>(TEST_URL_OPTIONS.slice(0, 2));

  const { data: caps } = useQuery({
    queryKey: ['diagnostics', 'capabilities'],
    queryFn: () => diagnosticsApi.getCapabilities(),
    staleTime: 60_000,
  });

  const toggleProvider = (id: string) => {
    setSelectedProviders((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const handleSubmit = () => {
    if (selectedProviders.length === 0) return;
    onSubmit({ providerIds: selectedProviders, timeoutMs, concurrency, testUrls });
  };

  return (
    <div className="rounded-md border border-line bg-white p-5 space-y-5">
      <h2 className="font-display font-semibold text-primary">Configure Diagnostic Run</h2>

      {caps && caps.singBoxAvailable === false && (
        <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm text-warning">
          <strong>Note:</strong> <code>sing-box</code> is not installed on this server.
          Protocol handshake probes (Layer 5) will be skipped.{' '}
          <span className="text-text-muted">TCP and config-level checks will still run.</span>
        </div>
      )}

      {/* Provider selection */}
      <div>
        <label className="block text-sm font-medium text-text mb-2">
          Providers to test <span className="text-danger">*</span>
        </label>
        {providers.length === 0 ? (
          <p className="text-sm text-text-muted">No providers available.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {providers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleProvider(p.id)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  selectedProviders.includes(p.id)
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-line text-text-muted hover:border-primary/40'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
        {selectedProviders.length === 0 && (
          <p className="mt-1 text-xs text-danger">Select at least one provider</p>
        )}
      </div>

      {/* Timeout */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">Timeout</label>
          <select
            className="w-full rounded border border-line bg-white px-3 py-2 text-sm text-text"
            value={timeoutMs}
            onChange={(e) => setTimeoutMs(Number(e.target.value))}
          >
            <option value={3000}>3 seconds</option>
            <option value={5000}>5 seconds (default)</option>
            <option value={10000}>10 seconds</option>
            <option value={15000}>15 seconds</option>
          </select>
        </div>

        {/* Concurrency */}
        <div>
          <label className="block text-sm font-medium text-text mb-1">Concurrency</label>
          <select
            className="w-full rounded border border-line bg-white px-3 py-2 text-sm text-text"
            value={concurrency}
            onChange={(e) => setConcurrency(Number(e.target.value))}
          >
            <option value={1}>1 (slowest, lowest load)</option>
            <option value={3}>3 (default)</option>
            <option value={5}>5 (fastest, highest load)</option>
          </select>
        </div>
      </div>

      <div>
        <p className="text-xs text-text-muted">
          Mode: <strong>Compare</strong> — fetches raw subscription, compares with IPSHub DB nodes, runs TCP probe and config diff.
        </p>
      </div>

      <Button
        variant="primary"
        isLoading={isLoading}
        disabled={selectedProviders.length === 0}
        onClick={handleSubmit}
      >
        Start Diagnostic Run
      </Button>
    </div>
  );
}
