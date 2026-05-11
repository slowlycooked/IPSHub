import { Button } from '@/components/ui/Button';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = 'Something went wrong.', onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-md border border-danger/30 bg-danger/5 px-5 py-4">
      <div className="flex items-start gap-3">
        <svg className="h-5 w-5 text-danger flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-medium text-danger">{message}</p>
          {onRetry && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onRetry}
              className="mt-3"
            >
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
