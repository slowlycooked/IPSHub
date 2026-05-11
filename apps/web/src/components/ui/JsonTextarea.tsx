import { useEffect, useMemo, useState } from 'react';

interface JsonTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onValidityChange?: (valid: boolean) => void;
  label?: string;
}

export function JsonTextarea({ value, onChange, onValidityChange, label }: JsonTextareaProps) {
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
      {label && (
        <label className="block text-sm font-medium text-text-muted mb-2">
          {label}
        </label>
      )}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="ip-input min-h-32 font-mono text-xs focus:border-primary focus:ring-2 focus:ring-primary/20"
        placeholder='{"key": "value"}'
      />
      {error && (
        <p className="mt-2 text-xs text-danger flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
