"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import * as React from "react";

import { cn } from "../../utils";

const Select = SelectPrimitive.Root;

const SelectGroup: React.FC<SelectPrimitive.Group.Props> = ({ className, ...props }) => {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  );
};

const SelectValue: React.FC<SelectPrimitive.Value.Props> = ({ className, ...props }) => {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex flex-1 text-left", className)}
      {...props}
    />
  );
};

type SelectTriggerProps = SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default";
};

const SelectTrigger: React.FC<SelectTriggerProps> = ({
  className,
  size = "default",
  children,
  ...props
}) => {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "border-border-input data-[placeholder]:text-foreground-muted dark:bg-gray-3 dark:hover:bg-gray-4 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex w-fit items-center justify-between gap-1.5 rounded-lg border bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-md *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <span
            aria-hidden="true"
            className="iconify ph--caret-down text-foreground-muted pointer-events-none size-4"
          />
        }
      />
    </SelectPrimitive.Trigger>
  );
};

type SelectContentProps = SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >;

const SelectContent: React.FC<SelectContentProps> = ({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}) => {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            "bg-surface-overlay text-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-open:blur-in-sm data-closed:blur-out-sm data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2 relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg shadow-md ring-1 duration-100 data-[align-trigger=true]:animate-none",
            className,
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
};

const SelectLabel: React.FC<SelectPrimitive.GroupLabel.Props> = ({ className, ...props }) => {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("text-foreground-muted px-1.5 py-1 text-xs", className)}
      {...props}
    />
  );
};

const SelectItem: React.FC<SelectPrimitive.Item.Props> = ({ className, children, ...props }) => {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "focus:bg-muted focus:text-foreground not-data-[variant=destructive]:focus:**:text-foreground relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <span aria-hidden="true" className="iconify ph--check pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
};

const SelectSeparator: React.FC<SelectPrimitive.Separator.Props> = ({ className, ...props }) => {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
};

const SelectScrollUpButton: React.FC<
  React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>
> = ({ className, ...props }) => {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "bg-surface-overlay top-0 z-10 flex w-full cursor-default items-center justify-center py-1 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="iconify ph--caret-up size-4" />
    </SelectPrimitive.ScrollUpArrow>
  );
};

const SelectScrollDownButton: React.FC<
  React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>
> = ({ className, ...props }) => {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bg-surface-overlay bottom-0 z-10 flex w-full cursor-default items-center justify-center py-1 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="iconify ph--caret-down size-4" />
    </SelectPrimitive.ScrollDownArrow>
  );
};

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
