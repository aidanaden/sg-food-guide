"use client";

import * as React from "react";
import * as z from "zod/v4-mini";

import { cn } from "../../utils";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "./select";

type TimeInputProps = {
  value?: string; // "HH:mm" 24h format
  onChange?: (time: string) => void;
  disabled?: boolean;
  className?: string;
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const PeriodSchema = z.enum(["AM", "PM"]);

// Parse 24h value into 12h format
function parseTime(timeStr?: string): { hour: number; minute: number; period: "AM" | "PM" } {
  if (timeStr == null || timeStr.length === 0) return { hour: 12, minute: 0, period: "AM" };
  const parts = timeStr.split(":").map(Number);
  const h = parts[0];
  const m = parts[1];
  if (h == null || m == null || isNaN(h) || isNaN(m)) {
    return { hour: 12, minute: 0, period: "AM" };
  }
  return {
    hour: h % 12 || 12,
    minute: m,
    period: h >= 12 ? "PM" : "AM",
  };
}

const TimeInput: React.FC<TimeInputProps> = ({ value, onChange, disabled, className }) => {
  const { hour, minute, period } = parseTime(value);

  // Convert 12h back to 24h "HH:mm" string
  const emitChange = (h: number, m: number, p: "AM" | "PM") => {
    let h24 = h % 12;
    if (p === "PM") h24 += 12;
    const timeStr = `${h24.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    onChange?.(timeStr);
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span aria-hidden="true" className="iconify ph--clock text-foreground-muted size-4" />

      {/* Hour Select */}
      <Select
        value={hour.toString()}
        onValueChange={(v) => emitChange(Number(v), minute, period)}
        disabled={disabled}
      >
        <SelectTrigger size="sm" className="w-14">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-60 min-w-0" alignItemWithTrigger={false}>
          {HOURS.map((h) => (
            <SelectItem key={h} value={h.toString()}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-foreground-muted">:</span>

      {/* Minute Select */}
      <Select
        value={minute.toString()}
        onValueChange={(v) => emitChange(hour, Number(v), period)}
        disabled={disabled}
      >
        <SelectTrigger size="sm" className="w-16">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-60 min-w-0" alignItemWithTrigger={false}>
          {MINUTES.map((m) => (
            <SelectItem key={m} value={m.toString()}>
              {m.toString().padStart(2, "0")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* AM/PM Select */}
      <Select
        value={period}
        onValueChange={(v) => {
          const parsed = z.safeParse(PeriodSchema, v);
          if (parsed.success) {
            emitChange(hour, minute, parsed.data);
          }
        }}
        disabled={disabled}
      >
        <SelectTrigger size="sm" className="w-16">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="min-w-0" alignItemWithTrigger={false}>
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export { TimeInput };
export type { TimeInputProps };
