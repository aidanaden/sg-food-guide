"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import * as React from "react";

import { cn } from "../../utils";

const DropdownMenu = MenuPrimitive.Root;

const DropdownMenuTrigger: React.FC<MenuPrimitive.Trigger.Props> = ({
  className,
  children,
  ...props
}) => {
  return (
    <MenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      className={cn("outline-none", className)}
      {...props}
    >
      {children}
    </MenuPrimitive.Trigger>
  );
};

type DropdownMenuContentProps = MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">;

const DropdownMenuContent: React.FC<DropdownMenuContentProps> = ({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  ...props
}) => {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        className="isolate z-50"
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "bg-surface-overlay text-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-open:blur-in-sm data-closed:blur-out-sm data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-border min-w-36 origin-(--transform-origin) overflow-hidden rounded-lg shadow-md ring-1 duration-100",
            className,
          )}
          {...props}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
};

const DropdownMenuItem: React.FC<MenuPrimitive.Item.Props> = ({
  className,
  children,
  ...props
}) => {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        "hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:hover:bg-destructive data-[variant=destructive]:hover:text-destructive-foreground data-[variant=destructive]:focus:bg-destructive data-[variant=destructive]:focus:text-destructive-foreground relative flex w-full cursor-default items-center gap-2 px-3 py-1.5 text-sm outline-hidden select-none first:pt-2 last:pb-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
    </MenuPrimitive.Item>
  );
};

const DropdownMenuSeparator: React.FC<React.ComponentProps<typeof MenuPrimitive.Separator>> = ({
  className,
  ...props
}) => {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("bg-border pointer-events-none -mx-1 h-px", className)}
      {...props}
    />
  );
};

const DropdownMenuLabel: React.FC<MenuPrimitive.GroupLabel.Props> = ({ className, ...props }) => {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      className={cn("text-foreground-muted px-3 py-3 text-xs font-semibold sm:py-2", className)}
      {...props}
    />
  );
};

const DropdownMenuGroup: React.FC<MenuPrimitive.Group.Props> = ({ className, ...props }) => {
  return (
    <MenuPrimitive.Group data-slot="dropdown-menu-group" className={cn("", className)} {...props} />
  );
};

const DropdownMenuSub = MenuPrimitive.SubmenuRoot;

const DropdownMenuSubTrigger: React.FC<MenuPrimitive.SubmenuTrigger.Props> = ({
  className,
  children,
  ...props
}) => {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      className={cn(
        "hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground data-[popup-open]:bg-muted data-[popup-open]:text-foreground relative flex w-full cursor-default items-center gap-2 px-3 py-1.5 text-sm outline-hidden select-none first:pt-2 last:pb-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <span aria-hidden="true" className="iconify ph--caret-right ml-auto size-4" />
    </MenuPrimitive.SubmenuTrigger>
  );
};

type DropdownMenuSubContentProps = MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, "alignOffset" | "sideOffset">;

const DropdownMenuSubContent: React.FC<DropdownMenuSubContentProps> = ({
  className,
  children,
  sideOffset = 2,
  alignOffset = -4,
  ...props
}) => {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        className="isolate z-50"
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-sub-content"
          className={cn(
            "bg-surface-overlay text-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-open:blur-in-sm data-closed:blur-out-sm data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-border min-w-36 origin-(--transform-origin) overflow-hidden rounded-lg shadow-md ring-1 duration-100",
            className,
          )}
          {...props}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
};

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
