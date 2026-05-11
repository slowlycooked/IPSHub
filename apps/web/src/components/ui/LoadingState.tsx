interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = 'Loading...' }: LoadingStateProps) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-md border border-neutral bg-white">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-b-primary" />
        <p className="mt-3 text-sm text-slate-600">{label}</p>
      </div>
    </div>
  );
}
