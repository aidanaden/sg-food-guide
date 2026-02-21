import type { Easing } from "motion/react";
import * as m from "motion/react-m";
import * as React from "react";

import { cn } from "../../utils";

type CollapseTransition = {
  duration?: number;
  ease?: Easing;
};

type CollapsibleProps = {
  open: boolean;
  children: React.ReactNode;
  className?: string;
  transition?: CollapseTransition;
};

const defaultTransition: CollapseTransition = { duration: 0.2, ease: "easeOut" };

/**
 * Animated collapse/expand container using motion.
 *
 * The element stays in the DOM at all times (no insertion/removal),
 * which avoids layout jumps from DOM changes or margin collapsing.
 *
 * Use `!mt-0` + inner `pt-*` when placed inside a `space-y-*` container
 * so the spacing collapses with the height animation.
 */
export const Collapsible: React.FC<CollapsibleProps> = ({
  open,
  children,
  className,
  transition = defaultTransition,
}) => {
  return (
    <m.div
      initial={false}
      animate={open ? "open" : "closed"}
      variants={{
        open: { height: "auto", opacity: 1 },
        closed: { height: 0, opacity: 0 },
      }}
      transition={transition}
      className={cn("overflow-hidden", className)}
      aria-hidden={!open}
      inert={!open}
    >
      {children}
    </m.div>
  );
};
