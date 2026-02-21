import * as React from "react";

import { cn } from "../../utils";

const Skeleton: React.FC<React.ComponentProps<"div">> = ({ className, ...props }) => {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-muted animate-pulse rounded-md", className)}
      {...props}
    />
  );
};

export { Skeleton };
