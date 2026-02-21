"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import * as React from "react";

import { cn } from "../../utils";

const Combobox = ComboboxPrimitive.Root;
const ComboboxCollection = ComboboxPrimitive.Collection;

const ComboboxTrigger: React.FC<React.ComponentProps<typeof ComboboxPrimitive.Trigger>> = ({
  className,
  ...props
}) => {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      className={cn(
        "border-border-input data-[placeholder]:text-foreground-muted dark:bg-gray-3 dark:hover:bg-gray-4 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border bg-transparent py-1 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
};

const ComboboxIcon: React.FC<React.ComponentProps<typeof ComboboxPrimitive.Icon>> = ({
  className,
  ...props
}) => {
  return (
    <ComboboxPrimitive.Icon
      data-slot="combobox-icon"
      className={cn("text-foreground-muted size-4", className)}
      {...props}
    />
  );
};

const ComboboxValue: React.FC<React.ComponentProps<typeof ComboboxPrimitive.Value>> = ({
  ...props
}) => {
  return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />;
};

const ComboboxInput: React.FC<React.ComponentProps<typeof ComboboxPrimitive.Input>> = ({
  className,
  ...props
}) => {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-input"
      className={cn(
        "dark:bg-gray-3 border-border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-gray-3 dark:disabled:bg-gray-5 placeholder:text-foreground-muted h-8 w-full min-w-0 rounded-lg border bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2 md:text-sm",
        className,
      )}
      {...props}
    />
  );
};

const ComboboxClear: React.FC<React.ComponentProps<typeof ComboboxPrimitive.Clear>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <ComboboxPrimitive.Clear
      data-slot="combobox-clear"
      className={cn(
        "text-foreground-muted hover:text-foreground inline-flex size-6 items-center justify-center rounded-md outline-none",
        className,
      )}
      {...props}
    >
      {children ?? <span aria-hidden="true" className="iconify ph--x size-4" />}
    </ComboboxPrimitive.Clear>
  );
};

const ComboboxChips: React.FC<React.ComponentProps<typeof ComboboxPrimitive.Chips>> = ({
  className,
  ...props
}) => {
  return (
    <ComboboxPrimitive.Chips
      data-slot="combobox-chips"
      className={cn("flex flex-wrap items-center gap-1", className)}
      {...props}
    />
  );
};

const ComboboxChip: React.FC<React.ComponentProps<typeof ComboboxPrimitive.Chip>> = ({
  className,
  ...props
}) => {
  return (
    <ComboboxPrimitive.Chip
      data-slot="combobox-chip"
      className={cn(
        "bg-muted text-foreground inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs",
        className,
      )}
      {...props}
    />
  );
};

const ComboboxChipRemove: React.FC<React.ComponentProps<typeof ComboboxPrimitive.ChipRemove>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <ComboboxPrimitive.ChipRemove
      data-slot="combobox-chip-remove"
      className={cn(
        "text-foreground-muted hover:text-foreground inline-flex size-4 items-center justify-center rounded-sm",
        className,
      )}
      {...props}
    >
      {children ?? <span aria-hidden="true" className="iconify ph--x size-3" />}
    </ComboboxPrimitive.ChipRemove>
  );
};

const ComboboxPortal: React.FC<React.ComponentProps<typeof ComboboxPrimitive.Portal>> = ({
  ...props
}) => {
  return <ComboboxPrimitive.Portal data-slot="combobox-portal" {...props} />;
};

const ComboboxPositioner: React.FC<React.ComponentProps<typeof ComboboxPrimitive.Positioner>> = ({
  className,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  ...props
}) => {
  return (
    <ComboboxPrimitive.Positioner
      data-slot="combobox-positioner"
      side={side}
      sideOffset={sideOffset}
      align={align}
      alignOffset={alignOffset}
      className={cn("isolate z-50", className)}
      {...props}
    />
  );
};

const ComboboxPopup: React.FC<React.ComponentProps<typeof ComboboxPrimitive.Popup>> = ({
  className,
  ...props
}) => {
  return (
    <ComboboxPrimitive.Popup
      data-slot="combobox-popup"
      className={cn(
        "bg-surface-overlay text-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-open:blur-in-sm data-closed:blur-out-sm data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2 ring-border relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-48 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg px-1 pt-1 pb-0 shadow-md ring-1 duration-100",
        className,
      )}
      {...props}
    />
  );
};

const ComboboxArrow: React.FC<React.ComponentProps<typeof ComboboxPrimitive.Arrow>> = ({
  className,
  ...props
}) => {
  return (
    <ComboboxPrimitive.Arrow
      data-slot="combobox-arrow"
      className={cn(
        "bg-surface-overlay ring-border relative size-2.5 rotate-45 rounded-sm ring-1",
        className,
      )}
      {...props}
    />
  );
};

const ComboboxBackdrop: React.FC<React.ComponentProps<typeof ComboboxPrimitive.Backdrop>> = ({
  className,
  ...props
}) => {
  return (
    <ComboboxPrimitive.Backdrop
      data-slot="combobox-backdrop"
      className={cn("fixed inset-0 z-40 bg-transparent", className)}
      {...props}
    />
  );
};

const ComboboxList: React.FC<React.ComponentProps<typeof ComboboxPrimitive.List>> = ({
  className,
  ...props
}) => {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn("grid gap-0.5", className)}
      {...props}
    />
  );
};

const ComboboxEmpty: React.FC<React.ComponentProps<typeof ComboboxPrimitive.Empty>> = ({
  className,
  ...props
}) => {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn("text-foreground-muted px-2 py-1 text-xs", className)}
      {...props}
    />
  );
};

const ComboboxGroup: React.FC<React.ComponentProps<typeof ComboboxPrimitive.Group>> = ({
  className,
  ...props
}) => {
  return (
    <ComboboxPrimitive.Group
      data-slot="combobox-group"
      className={cn("grid gap-1", className)}
      {...props}
    />
  );
};

const ComboboxGroupLabel: React.FC<React.ComponentProps<typeof ComboboxPrimitive.GroupLabel>> = ({
  className,
  ...props
}) => {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot="combobox-group-label"
      className={cn("text-foreground-muted px-2 py-1 text-xs", className)}
      {...props}
    />
  );
};

const ComboboxItem: React.FC<React.ComponentProps<typeof ComboboxPrimitive.Item>> = ({
  className,
  ...props
}) => {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "data-[highlighted]:bg-muted data-[highlighted]:text-foreground data-[selected]:bg-muted hover:bg-muted hover:text-foreground relative flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    />
  );
};

const ComboboxItemIndicator: React.FC<
  React.ComponentProps<typeof ComboboxPrimitive.ItemIndicator>
> = ({ className, children, ...props }) => {
  return (
    <ComboboxPrimitive.ItemIndicator
      data-slot="combobox-item-indicator"
      className={cn("text-primary ml-auto flex size-4 items-center justify-center", className)}
      {...props}
    >
      {children ?? <span aria-hidden="true" className="iconify ph--check size-4" />}
    </ComboboxPrimitive.ItemIndicator>
  );
};

const ComboboxRow: React.FC<React.ComponentProps<typeof ComboboxPrimitive.Row>> = ({
  className,
  ...props
}) => {
  return (
    <ComboboxPrimitive.Row
      data-slot="combobox-row"
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  );
};

const ComboboxSeparator: React.FC<React.ComponentProps<typeof ComboboxPrimitive.Separator>> = ({
  className,
  ...props
}) => {
  return (
    <ComboboxPrimitive.Separator
      data-slot="combobox-separator"
      className={cn("bg-border my-1 h-px", className)}
      {...props}
    />
  );
};

const ComboboxStatus: React.FC<React.ComponentProps<typeof ComboboxPrimitive.Status>> = ({
  className,
  ...props
}) => {
  return (
    <ComboboxPrimitive.Status
      data-slot="combobox-status"
      className={cn("sr-only", className)}
      {...props}
    />
  );
};

export {
  Combobox,
  ComboboxArrow,
  ComboboxBackdrop,
  ComboboxChip,
  ComboboxChipRemove,
  ComboboxChips,
  ComboboxClear,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxIcon,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxPopup,
  ComboboxPortal,
  ComboboxPositioner,
  ComboboxRow,
  ComboboxSeparator,
  ComboboxStatus,
  ComboboxTrigger,
  ComboboxValue,
};
