"use client";

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import * as React from "react";

import { cn } from "../../utils";

const Accordion: React.FC<AccordionPrimitive.Root.Props> = ({ className, ...props }) => {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("flex w-full flex-col", className)}
      {...props}
    />
  );
};

const AccordionItem: React.FC<AccordionPrimitive.Item.Props> = ({ className, ...props }) => {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("not-last:border-b", className)}
      {...props}
    />
  );
};

const AccordionTrigger: React.FC<AccordionPrimitive.Trigger.Props> = ({
  className,
  children,
  ...props
}) => {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "focus-visible:ring-ring focus-visible:border-ring focus-visible:after:border-ring hover:bg-muted hover:text-foreground **:data-[slot=accordion-trigger-icon]:text-foreground-muted group/accordion-trigger relative flex flex-1 cursor-pointer items-center justify-between rounded-lg border border-transparent py-2.5 text-left text-sm font-medium transition-all outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4",
          className,
        )}
        {...props}
      >
        {children}
        <span
          aria-hidden="true"
          data-slot="accordion-trigger-icon"
          className="iconify ph--caret-down pointer-events-none shrink-0 group-hover/accordion-trigger:text-foreground group-aria-expanded/accordion-trigger:hidden"
        />
        <span
          aria-hidden="true"
          data-slot="accordion-trigger-icon"
          className="iconify ph--caret-up pointer-events-none hidden shrink-0 group-hover/accordion-trigger:text-foreground group-aria-expanded/accordion-trigger:inline"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
};

const AccordionContent: React.FC<AccordionPrimitive.Panel.Props> = ({
  className,
  children,
  ...props
}) => {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className="data-open:animate-accordion-down data-closed:animate-accordion-up overflow-hidden text-sm"
      {...props}
    >
      <div
        className={cn(
          "[&_a]:hover:text-foreground h-(--accordion-panel-height) pt-0 pb-2.5 data-ending-style:h-0 data-starting-style:h-0 [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4",
          className,
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Panel>
  );
};

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
