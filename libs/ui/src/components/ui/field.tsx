import * as React from "react";

import { cn } from "../../utils";
import { Label } from "./label";

const Field: React.FC<React.ComponentProps<"div">> = ({ className, ...props }) => {
  return <div data-slot="field" className={cn("group/field grid gap-2", className)} {...props} />;
};

const FieldLabel: React.FC<React.ComponentProps<typeof Label>> = ({ className, ...props }) => {
  return (
    <Label
      data-slot="field-label"
      className={cn("text-sm leading-none font-medium", className)}
      {...props}
    />
  );
};

const FieldDescription: React.FC<React.ComponentProps<"p">> = ({ className, ...props }) => {
  return (
    <p
      data-slot="field-description"
      className={cn("text-foreground-muted text-sm", className)}
      {...props}
    />
  );
};

const FieldError: React.FC<React.ComponentProps<"p">> = ({ className, ...props }) => {
  return (
    <p
      data-slot="field-error"
      className={cn("text-destructive text-sm font-medium", className)}
      {...props}
    />
  );
};

const FieldGroup: React.FC<React.ComponentProps<"div">> = ({ className, ...props }) => {
  return <div data-slot="field-group" className={cn("space-y-4", className)} {...props} />;
};

export { Field, FieldLabel, FieldDescription, FieldError, FieldGroup };
