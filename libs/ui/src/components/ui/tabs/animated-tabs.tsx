import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { type ReactNode } from "react";

import { cn } from "../../../utils";
import { Button } from "../button";

type AnimatedTabsOption<T extends string> = {
  value: T;
  label: ReactNode;
};

type AnimatedTabsProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: AnimatedTabsOption<T>[];
  layoutId: string;
  className?: string;
};

// Optimized spring transition for snappy mobile feel
const SPRING_TRANSITION = {
  type: "spring",
  visualDuration: 0.25,
  bounce: 0.15,
} as const;

export function AnimatedTabs<T extends string>({
  value,
  onChange,
  options,
  layoutId,
  className,
}: AnimatedTabsProps<T>) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      data-slot="animated-tabs"
      className={cn("bg-muted relative flex items-center rounded-lg p-0.5", className)}
    >
      {options.map((option) => {
        const isActive = value === option.value;

        return (
          <Button
            key={option.value}
            type="button"
            variant="ghost"
            size="sm"
            data-slot="animated-tabs-trigger"
            data-active={isActive || undefined}
            onClick={() => onChange(option.value)}
            className="text-foreground-muted data-[active]:text-foreground hover:bg-muted-hover hover:text-foreground data-[active]:hover:bg-transparent relative z-10 h-auto min-h-0 flex-1 cursor-pointer border-0 bg-transparent px-3 py-1.5 text-center text-sm font-medium transition-colors sm:flex-none sm:text-left"
          >
            {/* Animated indicator - skipped for reduced motion users */}
            {isActive && shouldReduceMotion !== true && (
              <m.div
                layoutId={layoutId}
                layoutDependency={value}
                data-slot="animated-tabs-indicator"
                className="bg-muted-hover absolute inset-0 -z-10 rounded-md"
                transition={SPRING_TRANSITION}
              />
            )}
            {/* Static indicator for reduced motion users */}
            {isActive && shouldReduceMotion === true && (
              <div
                data-slot="animated-tabs-indicator"
                className="bg-muted-hover absolute inset-0 -z-10 rounded-md"
              />
            )}
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
