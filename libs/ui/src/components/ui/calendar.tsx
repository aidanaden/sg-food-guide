"use client";

import * as React from "react";
import { DayPicker, type DayButton } from "react-day-picker";

import { cn } from "../../utils";
import { Button, buttonVariants } from "./button";

function CalendarRoot({
  className,
  rootRef,
  ...props
}: { className?: string; rootRef?: React.Ref<HTMLDivElement> } & React.ComponentProps<"div">) {
  return <div data-slot="calendar" ref={rootRef} className={className} {...props} />;
}

function CalendarChevron({ className, orientation }: { className?: string; orientation?: string }) {
  if (orientation === "left") {
    return (
      <span
        aria-hidden="true"
        className={cn("iconify ph--caret-left text-foreground size-4", className)}
      />
    );
  }

  if (orientation === "right") {
    return (
      <span
        aria-hidden="true"
        className={cn("iconify ph--caret-right text-foreground size-4", className)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn("iconify ph--caret-down text-foreground size-4", className)}
    />
  );
}

function CalendarWeekNumber({ children, ...props }: React.ComponentProps<"td">) {
  return (
    <td {...props}>
      <div className="flex size-(--cell-size) items-center justify-center text-center">
        {children}
      </div>
    </td>
  );
}

type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
};

const Calendar: React.FC<CalendarProps> = ({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}) => {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "bg-background group/calendar p-2 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(7)] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className,
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) => date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: "w-full",
        months: "flex gap-4 flex-col md:flex-row relative",
        month: "flex flex-col w-full gap-4",
        nav: "flex items-center gap-1 w-full absolute top-0 inset-x-0 justify-between",
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
        ),
        month_caption: "flex items-center justify-center h-(--cell-size) w-full px-(--cell-size)",
        dropdowns:
          "w-full flex items-center text-sm font-medium justify-center h-(--cell-size) gap-1.5",
        dropdown_root: "relative rounded-(--cell-radius)",
        dropdown: "absolute bg-surface-overlay inset-0 opacity-0",
        caption_label: cn(
          "font-medium select-none",
          captionLayout === "label"
            ? "text-sm"
            : "[&>svg]:text-foreground-muted flex items-center gap-1 rounded-(--cell-radius) text-sm [&>svg]:size-3.5",
        ),
        table: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "text-foreground-muted rounded-(--cell-radius) flex-1 font-normal text-xs select-none text-center",
        week: "flex w-full mt-2",
        week_number_header: "select-none w-(--cell-size)",
        week_number: "text-xs select-none text-foreground-muted",
        day: cn(
          "group/day relative aspect-square h-full flex-1 rounded-(--cell-radius) p-0 text-center select-none [&:last-child[data-selected=true]_button]:rounded-r-(--cell-radius)",
          props.showWeekNumber === true
            ? "[&:nth-child(2)[data-selected=true]_button]:rounded-l-(--cell-radius)"
            : "[&:first-child[data-selected=true]_button]:rounded-l-(--cell-radius)",
        ),
        range_start:
          "rounded-l-(--cell-radius) bg-muted relative after:bg-muted after:absolute after:inset-y-0 after:w-4 after:right-0 -z-0 isolate",
        range_middle: "rounded-none",
        range_end:
          "rounded-r-(--cell-radius) bg-muted relative after:bg-muted after:absolute after:inset-y-0 after:w-4 after:left-0 -z-0 isolate",
        today: "bg-muted text-foreground rounded-(--cell-radius) data-[selected=true]:rounded-none",
        outside: "text-foreground-muted aria-selected:text-foreground-muted",
        disabled: "text-foreground-muted opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Root: CalendarRoot,
        Chevron: CalendarChevron,
        DayButton: CalendarDayButton,
        WeekNumber: CalendarWeekNumber,
        ...components,
      }}
      {...props}
    />
  );
};

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused === true) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <Button
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected === true &&
        modifiers.range_start !== true &&
        modifiers.range_end !== true &&
        modifiers.range_middle !== true
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[selected-single=true]:hover:!bg-primary data-[selected-single=true]:hover:!text-primary-foreground data-[range-middle=true]:bg-muted data-[range-middle=true]:text-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-start=true]:hover:!bg-primary data-[range-start=true]:hover:!text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-end=true]:hover:!bg-primary data-[range-end=true]:hover:!text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 dark:hover:text-foreground relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 border-0 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-2 data-[range-end=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-r-(--cell-radius) data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-(--cell-radius) data-[range-start=true]:rounded-l-(--cell-radius) [&>span]:text-xs [&>span]:opacity-70",
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
