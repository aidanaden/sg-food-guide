"use client";

import { format } from "date-fns";
import * as React from "react";

import { cn } from "../../utils";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { TimeInput } from "./time-input";

type DateTimePickerProps = {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  min?: Date;
};

const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  className,
  min,
}) => {
  const time = value ? format(value, "HH:mm") : "00:00";

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      const parts = time.split(":").map(Number);
      const hours = parts[0];
      const minutes = parts[1];
      if (hours != null && minutes != null && !isNaN(hours) && !isNaN(minutes)) {
        newDate.setHours(hours, minutes);
      }
      onChange?.(newDate);
    } else {
      onChange?.(undefined);
    }
  };

  const handleTimeChange = (newTime: string) => {
    if (value && newTime) {
      const parts = newTime.split(":").map(Number);
      const hours = parts[0];
      const minutes = parts[1];
      if (hours != null && minutes != null && !isNaN(hours) && !isNaN(minutes)) {
        const newDate = new Date(value);
        newDate.setHours(hours, minutes);
        onChange?.(newDate);
      }
    }
  };

  return (
    <Popover>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "border-border-input bg-background hover:border-border-hover hover:bg-muted-hover inline-flex w-full items-center justify-start rounded-lg border px-3 py-2 text-left text-sm font-normal transition-colors",
          !value && "text-foreground-muted",
          className,
        )}
      >
        <span aria-hidden="true" className="iconify ph--calendar-blank mr-2 size-4" />
        {value ? format(value, "PPP h:mm a") : placeholder}
      </PopoverTrigger>
      <PopoverContent className="w-auto gap-0 p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={handleDateSelect}
          disabled={min ? { before: min } : undefined}
        />
        <div className="border-t p-3">
          <TimeInput value={time} onChange={handleTimeChange} />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export { DateTimePicker };
export type { DateTimePickerProps };
