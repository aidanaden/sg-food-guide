import { type FC } from "react";

import { cn } from "../../../utils";
import { Button } from "../button";

type DialogActionButtonProps = React.ComponentProps<typeof Button> & {
  loading?: boolean;
};

const DialogActionButton: FC<DialogActionButtonProps> = ({
  className,
  children,
  loading,
  disabled,
  variant,
  size,
  ...props
}) => {
  const isDisabled = (disabled ?? false) || (loading ?? false);

  return (
    <Button
      className={cn("min-w-24", className)}
      disabled={isDisabled}
      variant={variant}
      size={size}
      {...props}
    >
      {loading === true ? (
        <span aria-hidden="true" className="iconify ph--spinner size-4 animate-spin" />
      ) : (
        children
      )}
    </Button>
  );
};

export { DialogActionButton };
export type { DialogActionButtonProps };
