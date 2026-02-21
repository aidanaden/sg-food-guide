import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/20 text-primary",
        secondary: "bg-muted text-foreground",
        outline: "border-border-input text-foreground-muted border",
        destructive: "bg-destructive/20 text-destructive",
        success: "bg-emerald-500/20 text-emerald-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export const Badge = ({ className, variant, ...props }: BadgeProps) => {
  return <span data-slot="badge" className={badgeVariants({ variant, className })} {...props} />;
};
