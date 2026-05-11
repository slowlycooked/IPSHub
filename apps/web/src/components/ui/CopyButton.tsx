import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

interface CopyButtonProps {
  text: string;
  message?: string;
  label?: string;
}

export function CopyButton({ text, message = 'Subscription URL copied', label = 'Copy' }: CopyButtonProps) {
  const { pushToast } = useToast();

  const onCopy = async () => {
    await navigator.clipboard.writeText(text);
    pushToast(message, 'success');
  };

  return (
    <Button variant="ghost" size="sm" onClick={onCopy}>
      {label}
    </Button>
  );
}
