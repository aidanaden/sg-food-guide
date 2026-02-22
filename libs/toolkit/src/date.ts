import { formatDistanceStrict, type FormatDistanceToken } from "date-fns";

const DASH = "-";

/**
 * Formats the given `date` as a relative time string.
 */
export function formatSimpleAge(date: Date | undefined | null, now: Date) {
  if (date === undefined || date === null) {
    return DASH;
  }

  const secondsDiff = Math.abs(Math.floor((date.getTime() - now.getTime()) / 1000));

  // Less than 60 secs, we show seconds only
  if (secondsDiff < 60) {
    return `${secondsDiff}s`;
  }

  // Less than 60 mins, we show minutes only
  const minutesDiff = Math.floor(secondsDiff / 60);
  if (minutesDiff < 60) {
    return `${minutesDiff}m`;
  }

  // Less than 24 hours, we show hours only
  const hoursDiff = Math.floor(minutesDiff / 60);
  if (hoursDiff < 24) {
    return `${hoursDiff}h`;
  }

  // Less than 30 days, we show days only
  const daysDiff = Math.floor(hoursDiff / 24);
  if (daysDiff < 30) {
    return `${daysDiff}d`;
  }

  // Less than 365 days, we show months only
  if (daysDiff < 365) {
    return `${Math.floor(daysDiff / 30)}mo`;
  }

  // More than 365 days, we show years only
  return `${Math.floor(daysDiff / 365)}y`;
}

const formatDistanceLocale: Record<FormatDistanceToken, (count: number) => string> = {
  lessThanXSeconds: (c) => `${c}s`,
  xSeconds: (c) => `${c}s`,
  halfAMinute: () => "30s",
  lessThanXMinutes: (c) => `${c}m`,
  xMinutes: (c) => `${c}m`,
  aboutXHours: (c) => `${c}h`,
  xHours: (c) => `${c}h`,
  xDays: (c) => `${c}d`,
  aboutXWeeks: (c) => `${c}w`,
  xWeeks: (c) => `${c}w`,
  aboutXMonths: (c) => `${c}mo`,
  xMonths: (c) => `${c}mo`,
  aboutXYears: (c) => `${c}y`,
  xYears: (c) => `${c}y`,
  overXYears: (c) => `${c}y`,
  almostXYears: (c) => `${c}y`,
};

export function formatAge(date: Date | undefined | null, now: Date) {
  if (date === undefined || date === null) {
    return DASH;
  }
  return formatDistanceStrict(date, now, {
    locale: { formatDistance: (token, count) => formatDistanceLocale[token](count) },
  });
}

export class _IntlDate {
  public readonly locale: string | undefined;

  constructor(locale?: string) {
    this.locale = locale;
  }

  private toDate(input: Date | string | number): Date | null {
    const date = new Date(input);
    return isNaN(date.valueOf()) ? null : date;
  }

  public toTimezone(
    input: Date | string | number,
    options?: {
      timezone?: string | undefined;
    },
  ): string {
    const date = new Date(input);
    const timeZonePart = new Intl.DateTimeFormat(this.locale, {
      timeZone: options?.timezone,
      timeZoneName: "short",
    })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName");
    return timeZonePart ? timeZonePart.value : "";
  }

  public format(
    inputDate: Date | string | number,
    options?: {
      timezone?: string | undefined;
      withoutDate?: boolean | undefined;
      withoutTime?: boolean | undefined;
      withoutSeconds?: boolean | undefined;
      withoutYear?: boolean | undefined;
      withTimezone?: boolean | undefined;
      hour12?: boolean | undefined;
    },
  ): string {
    const date = this.toDate(inputDate);
    if (date === null) {
      return DASH;
    }
    const withoutYear = options?.withoutYear === true;
    const withoutTime = options?.withoutTime === true;
    const withTimezone = options?.withTimezone === true;
    const withoutSeconds = options?.withoutSeconds === true;
    const withoutDate = options?.withoutDate === true;

    const datePart = date.toLocaleDateString(this.locale, {
      timeZone: options?.timezone,
      day: "numeric",
      month: "short",
      year: withoutYear ? undefined : "numeric",
      timeZoneName: withoutTime ? (withTimezone ? "short" : undefined) : undefined,
    });
    const timePart = date.toLocaleTimeString(this.locale, {
      timeZone: options?.timezone,
      hour: "2-digit",
      minute: "2-digit",
      second: withoutSeconds ? undefined : "2-digit",
      timeZoneName: withTimezone ? "short" : undefined,
      hour12: options?.hour12,
    });
    return withoutDate ? timePart : withoutTime ? datePart : `${datePart} ${timePart}`;
  }
}

export const intlDate = new _IntlDate();
