"use client";

import * as React from "react";

import { cn } from "../../utils";
import { Input } from "./input";

const InputGroup: React.FC<React.ComponentProps<"div">> = ({ className, ...props }) => {
  return (
    <div
      data-slot="input-group"
      className={cn(
        "bg-surface-raised border-border-input hover:bg-surface-hover hover:border-border-hover focus-within:border-ring focus-within:ring-ring aria-invalid:ring-destructive aria-invalid:ring-destructive aria-invalid:border-destructive aria-invalid:border-destructive has-[>[data-slot=input-group-control]:disabled]:bg-muted-hover flex min-h-8 min-w-0 flex-wrap items-center gap-1 rounded-lg border px-2.5 py-1 transition-colors outline-none focus-within:ring-2 has-[>[data-slot=input-group-control]:disabled]:cursor-not-allowed aria-invalid:ring-2 [&>[data-slot=input-group-control]]:h-6 [&>[data-slot=input-group-control]]:min-w-0 [&>[data-slot=input-group-control]]:flex-1 [&>[data-slot=input-group-control]]:basis-0 [&>[data-slot=input-group-control]]:border-0 [&>[data-slot=input-group-control]]:bg-transparent [&>[data-slot=input-group-control]]:px-0 [&>[data-slot=input-group-control]]:py-0 [&>[data-slot=input-group-control]]:shadow-none [&>[data-slot=input-group-control]]:outline-none [&>[data-slot=input-group-control]]:focus-visible:border-transparent [&>[data-slot=input-group-control]]:focus-visible:ring-0 [&>[data-slot=input-group-control]]:disabled:bg-transparent [&>[data-slot=input-group-control]]:aria-invalid:border-transparent [&>[data-slot=input-group-control]]:aria-invalid:ring-0",
        className,
      )}
      {...props}
    />
  );
};

const inputGroupAddonAlignClasses = {
  "inline-start": "order-first",
  "inline-end": "order-last ml-auto",
  "block-start": "order-first basis-full justify-start",
  "block-end": "order-last basis-full justify-end",
} as const;

type InputGroupAddonAlign = keyof typeof inputGroupAddonAlignClasses;

type InputGroupAddonProps = React.ComponentProps<"div"> & {
  align?: InputGroupAddonAlign;
};

const InputGroupAddon: React.FC<InputGroupAddonProps> = ({
  className,
  align = "inline-start",
  ...props
}) => {
  return (
    <div
      data-slot="input-group-addon"
      className={cn(
        "text-foreground-muted flex min-h-6 shrink-0 items-center gap-1 text-xs [&_svg]:shrink-0",
        inputGroupAddonAlignClasses[align],
        className,
      )}
      {...props}
    />
  );
};

const InputGroupInput: React.FC<React.ComponentProps<typeof Input>> = ({ className, ...props }) => {
  return <Input data-slot="input-group-control" className={cn("h-6", className)} {...props} />;
};

export { InputGroup, InputGroupAddon, InputGroupInput };
export type { InputGroupAddonAlign, InputGroupAddonProps };
