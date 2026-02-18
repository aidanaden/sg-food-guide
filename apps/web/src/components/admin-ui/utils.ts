import { Result } from 'better-result';

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function sanitizeExternalHref(href: string): string {
  if (!/^https?:\/\//i.test(href)) {
    return "about:blank";
  }

  const parsedResult = Result.try(() => new URL(href));
  if (Result.isError(parsedResult)) {
    return "about:blank";
  }

  const parsed = parsedResult.value;
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    return "about:blank";
  }
  return parsed.href;
}

export function formatRelativeAge(value: Date | number | string | null | undefined): string {
  if (value == null) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);
  const ts = date.getTime();
  if (Number.isNaN(ts)) {
    return "-";
  }

  const diffMs = Date.now() - ts;
  const absSeconds = Math.floor(Math.abs(diffMs) / 1000);

  if (absSeconds < 60) {
    return `${absSeconds}s`;
  }

  const absMinutes = Math.floor(absSeconds / 60);
  if (absMinutes < 60) {
    return `${absMinutes}m`;
  }

  const absHours = Math.floor(absMinutes / 60);
  if (absHours < 24) {
    return `${absHours}h`;
  }

  const absDays = Math.floor(absHours / 24);
  if (absDays < 30) {
    return `${absDays}d`;
  }

  const absMonths = Math.floor(absDays / 30);
  if (absMonths < 12) {
    return `${absMonths}mo`;
  }

  const absYears = Math.floor(absMonths / 12);
  return `${absYears}y`;
}
