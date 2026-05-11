interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = 'Something went wrong.', onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-[24px] border border-red-400/30 bg-red-500/10 px-6 py-5 text-sm text-red-200">
      <p>{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-2xl border border-red-400/30 bg-white/[0.05] px-3 py-2 text-xs font-medium text-red-100"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
