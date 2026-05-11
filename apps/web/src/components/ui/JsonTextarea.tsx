import { useEffect, useMemo, useState } from 'react';

interface JsonTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onValidityChange?: (valid: boolean) => void;
}

export function JsonTextarea({ value, onChange, onValidityChange }: JsonTextareaProps) {
  const [error, setError] = useState('');

  const isValid = useMemo(() => {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }, [value]);

  useEffect(() => {
    setError(isValid ? '' : 'Invalid JSON format');
    if (onValidityChange) {
      onValidityChange(isValid);
    }
  }, [isValid, onValidityChange]);

  return (
    <div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[220px] w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
