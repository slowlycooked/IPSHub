export function formatDateTime(value?: string | number): string {
  if (value === undefined || value === null || value === '') {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString();
}

export function formatDuration(value?: number): string {
  if (!value) {
    return '-';
  }

  if (value < 1000) {
    return `${value} ms`;
  }

  if (value < 60000) {
    return `${(value / 1000).toFixed(1)} s`;
  }

  return `${Math.round(value / 1000)} s`;
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
