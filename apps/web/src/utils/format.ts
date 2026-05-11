export function formatDateTime(value?: string): string {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString();
}

export function truncate(value: string | undefined, max = 36): string {
  if (!value) {
    return '-';
  }
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}...`;
}
