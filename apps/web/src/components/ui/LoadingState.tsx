interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = 'Loading...' }: LoadingStateProps) {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-md border border-line bg-white p-8">
      <div className="text-center">
        <div className="relative mx-auto h-8 w-8">
          <svg
            className="absolute inset-0 h-8 w-8 animate-spin text-line"
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          </svg>
          <svg
            className="absolute inset-0 h-8 w-8 animate-spin text-primary"
            fill="none" 
            viewBox="0 0 24 24"
            style={{
              animationDirection: 'reverse',
              animationDuration: '0.8s'
            }}
          >
            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <p className="mt-3 text-sm text-text-muted">{label}</p>
      </div>
    </div>
  );
}
