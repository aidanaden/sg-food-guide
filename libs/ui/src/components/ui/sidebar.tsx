import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { useIsMobile } from "../../environment";
import { cn } from "../../utils";
import { Button } from "./button";
import { Drawer, DrawerContent } from "./drawer";
import { Input } from "./input";
import { Separator } from "./separator";
import { Skeleton } from "./skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

type SidebarSetOpen = React.Dispatch<React.SetStateAction<boolean>>;

type SidebarContextValue = {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: SidebarSetOpen;
  openMobile: boolean;
  setOpenMobile: SidebarSetOpen;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebar(): SidebarContextValue {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  return context;
}

type SidebarProviderProps = React.ComponentProps<"div"> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const SidebarProvider: React.FC<SidebarProviderProps> = ({
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  className,
  style,
  children,
  ...props
}) => {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = React.useState(false);
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);

  const open = openProp ?? internalOpen;

  const setOpen = React.useCallback<SidebarSetOpen>(
    (value) => {
      const nextOpen = typeof value === "function" ? value(open) : value;
      if (onOpenChange) {
        onOpenChange(nextOpen);
      } else {
        setInternalOpen(nextOpen);
      }
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${nextOpen}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    },
    [onOpenChange, open],
  );

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile((prev) => !prev);
      return;
    }
    setOpen((prev) => !prev);
  }, [isMobile, setOpen]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  const state = open ? "expanded" : "collapsed";

  const contextValue = React.useMemo<SidebarContextValue>(
    () => ({
      state,
      open,
      setOpen,
      openMobile,
      setOpenMobile,
      isMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, openMobile, setOpenMobile, isMobile, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delay={0}>
        <div
          data-slot="sidebar-wrapper"
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH,
              "--sidebar-width-mobile": SIDEBAR_WIDTH_MOBILE,
              "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
              ...style,
            } as React.CSSProperties
          }
          className={cn("group/sidebar-wrapper flex min-h-screen w-full", className)}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
};

type SidebarProps = React.ComponentProps<"div"> & {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
};

const Sidebar: React.FC<SidebarProps> = ({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  ...props
}) => {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

  if (collapsible === "none") {
    return (
      <div
        data-slot="sidebar"
        data-sidebar="sidebar"
        data-variant={variant}
        data-side={side}
        className={cn(
          "bg-surface text-foreground border-border hidden h-svh w-(--sidebar-width) shrink-0 flex-col border-r md:flex",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <Drawer open={openMobile} onOpenChange={setOpenMobile}>
        <DrawerContent
          data-slot="sidebar"
          data-sidebar="sidebar"
          data-mobile="true"
          className={cn(
            "bg-surface text-foreground p-0 [&>button]:hidden",
            side === "left" &&
              "top-0 right-auto bottom-auto left-0 mt-0 h-svh w-(--sidebar-width-mobile) rounded-none",
            side === "right" &&
              "top-0 right-0 bottom-auto left-auto mt-0 h-svh w-(--sidebar-width-mobile) rounded-none",
            side === "left" || side === "right" ? "" : "w-(--sidebar-width-mobile)",
          )}
        >
          <div className="flex h-full w-full flex-col">{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  const collapsed = state === "collapsed";
  const gapWidth =
    collapsed && collapsible === "offcanvas"
      ? "0"
      : collapsed && collapsible === "icon"
        ? "var(--sidebar-width-icon)"
        : "var(--sidebar-width)";

  const containerWidth =
    collapsed && collapsible === "icon" ? "var(--sidebar-width-icon)" : "var(--sidebar-width)";

  const containerPositionStyle =
    side === "left"
      ? {
          left: collapsed && collapsible === "offcanvas" ? "calc(var(--sidebar-width) * -1)" : "0",
        }
      : {
          right: collapsed && collapsible === "offcanvas" ? "calc(var(--sidebar-width) * -1)" : "0",
        };

  return (
    <div
      data-slot="sidebar"
      data-sidebar="sidebar"
      data-state={state}
      data-collapsible={collapsed ? collapsible : ""}
      data-variant={variant}
      data-side={side}
      className="group peer text-foreground hidden md:block"
    >
      <div
        data-slot="sidebar-gap"
        className="relative h-svh shrink-0 bg-transparent transition-[width] duration-200 ease-linear"
        style={{ width: gapWidth }}
      />
      <div
        data-slot="sidebar-container"
        className={cn(
          "fixed inset-y-0 z-20 hidden h-svh transition-[left,right,width] duration-200 ease-linear md:flex",
          variant !== "sidebar" && "p-2",
          className,
        )}
        style={{ ...containerPositionStyle, width: containerWidth }}
        {...props}
      >
        <div
          data-slot="sidebar-inner"
          data-sidebar="sidebar-inner"
          className={cn(
            "bg-surface text-foreground flex h-full w-full min-w-0 flex-col",
            variant === "sidebar" && side === "left" && "border-border border-r",
            variant === "sidebar" && side === "right" && "border-border border-l",
            variant !== "sidebar" && "border-border rounded-lg border shadow-sm",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

const SidebarTrigger: React.FC<React.ComponentProps<typeof Button>> = ({
  className,
  onClick,
  ...props
}) => {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      data-slot="sidebar-trigger"
      data-sidebar="trigger"
      variant="ghost"
      size="icon-sm"
      className={cn("size-7", className)}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <span aria-hidden="true" className="iconify ph--sidebar-simple size-4" />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
};

const SidebarRail: React.FC<React.ComponentProps<"button">> = ({ className, ...props }) => {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      data-slot="sidebar-rail"
      data-sidebar="rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      className={cn(
        "border-border hover:bg-muted/70 absolute inset-y-0 z-30 hidden w-4 -translate-x-1/2 cursor-pointer transition-colors sm:flex",
        "group-data-[side=left]:-right-4 group-data-[side=right]:-left-4",
        className,
      )}
      {...props}
    />
  );
};

const SidebarInset: React.FC<React.ComponentProps<"main">> = ({ className, ...props }) => {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        "bg-background relative flex min-w-0 flex-1 flex-col",
        "md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:rounded-lg md:peer-data-[variant=inset]:shadow-sm",
        className,
      )}
      {...props}
    />
  );
};

const SidebarInput: React.FC<React.ComponentProps<typeof Input>> = ({ className, ...props }) => {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn("h-8 w-full shadow-none", className)}
      {...props}
    />
  );
};

const SidebarHeader: React.FC<React.ComponentProps<"div">> = ({ className, ...props }) => {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  );
};

const SidebarFooter: React.FC<React.ComponentProps<"div">> = ({ className, ...props }) => {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  );
};

const SidebarSeparator: React.FC<React.ComponentProps<typeof Separator>> = ({
  className,
  ...props
}) => {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn("bg-border mx-2 w-auto", className)}
      {...props}
    />
  );
};

const SidebarContent: React.FC<React.ComponentProps<"div">> = ({ className, ...props }) => {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
        className,
      )}
      {...props}
    />
  );
};

const SidebarGroup: React.FC<React.ComponentProps<"div">> = ({ className, ...props }) => {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
      {...props}
    />
  );
};

type SlotChildProps = {
  className?: string;
} & Record<string, unknown>;

type SlotProps = React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode;
};

const SidebarSlot: React.FC<SlotProps> = ({ children, className, ...props }) => {
  if (!React.isValidElement<SlotChildProps>(children)) {
    return null;
  }

  const child = children;

  return React.cloneElement<SlotChildProps>(child, {
    ...child.props,
    ...props,
    className: cn(child.props.className, className),
  });
};

type SkeletonStyle = React.CSSProperties & {
  "--skeleton-width": string;
};

const SidebarGroupLabel: React.FC<React.ComponentProps<"div"> & { asChild?: boolean }> = ({
  className,
  asChild = false,
  ...props
}) => {
  const Comp: React.ElementType = asChild ? SidebarSlot : "div";
  return (
    <Comp
      data-slot="sidebar-group-label"
      data-sidebar="group-label"
      className={cn(
        "text-foreground-muted flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium transition-[margin,opacity] duration-200 ease-linear group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        className,
      )}
      {...props}
    />
  );
};

const SidebarGroupAction: React.FC<React.ComponentProps<"button"> & { asChild?: boolean }> = ({
  className,
  asChild = false,
  ...props
}) => {
  const Comp: React.ElementType = asChild ? SidebarSlot : "button";

  return (
    <Comp
      data-slot="sidebar-group-action"
      data-sidebar="group-action"
      className={cn(
        "text-foreground-muted hover:bg-muted hover:text-foreground absolute top-3 right-3 flex size-5 items-center justify-center rounded-md p-0 group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
};

const SidebarGroupContent: React.FC<React.ComponentProps<"div">> = ({ className, ...props }) => {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn("w-full text-sm", className)}
      {...props}
    />
  );
};

const SidebarMenu: React.FC<React.ComponentProps<"ul">> = ({ className, ...props }) => {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      {...props}
    />
  );
};

const SidebarMenuItem: React.FC<React.ComponentProps<"li">> = ({ className, ...props }) => {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn("group/menu-item relative", className)}
      {...props}
    />
  );
};

const sidebarMenuButtonVariants = cva(
  "peer/menu-button ring-ring/50 hover:bg-muted hover:text-foreground data-[active=true]:bg-muted data-[active=true]:text-foreground flex w-full items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-left text-sm transition-colors outline-none group-has-data-[sidebar=menu-action]/menu-item:pr-8 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2 focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 data-[active=true]:font-medium [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "",
        outline: "bg-background border-border hover:bg-muted border shadow-xs",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm group-data-[collapsible=icon]:p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type SidebarMenuButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof sidebarMenuButtonVariants> & {
    asChild?: boolean;
    isActive?: boolean;
    tooltip?: string | React.ComponentProps<typeof TooltipContent>;
  };

const SidebarMenuButton: React.FC<SidebarMenuButtonProps> = ({
  asChild = false,
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}) => {
  const Comp: React.ElementType = asChild ? SidebarSlot : "button";
  const { isMobile, state } = useSidebar();

  const button = (
    <Comp
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      data-size={size}
      data-active={isActive}
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      {...props}
    />
  );

  if (tooltip == null) {
    return button;
  }

  const tooltipProps = typeof tooltip === "string" ? { children: tooltip } : tooltip;

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent
        side="right"
        align="center"
        hidden={state !== "collapsed" || isMobile}
        {...tooltipProps}
      />
    </Tooltip>
  );
};

const SidebarMenuAction: React.FC<
  React.ComponentProps<"button"> & { asChild?: boolean; showOnHover?: boolean }
> = ({ className, asChild = false, showOnHover = false, ...props }) => {
  const Comp: React.ElementType = asChild ? SidebarSlot : "button";

  return (
    <Comp
      data-slot="sidebar-menu-action"
      data-sidebar="menu-action"
      className={cn(
        "text-foreground-muted hover:bg-muted hover:text-foreground peer-hover/menu-button:text-foreground absolute top-1.5 right-1 flex size-5 items-center justify-center rounded-md p-0 group-data-[collapsible=icon]:hidden",
        showOnHover &&
          "peer-data-[active=true]/menu-button:text-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0",
        className,
      )}
      {...props}
    />
  );
};

const SidebarMenuBadge: React.FC<React.ComponentProps<"div">> = ({ className, ...props }) => {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        "text-foreground-muted pointer-events-none absolute top-1.5 right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums select-none group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
};

const SidebarMenuSkeleton: React.FC<React.ComponentProps<"div"> & { showIcon?: boolean }> = ({
  className,
  showIcon = false,
  ...props
}) => {
  const width = React.useMemo(() => `${Math.floor(Math.random() * 40) + 50}%`, []);
  const skeletonStyle: SkeletonStyle = { "--skeleton-width": width };

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
      {...props}
    >
      {showIcon && <Skeleton className="size-4 rounded-md" data-sidebar="menu-skeleton-icon" />}
      <Skeleton
        className="h-4 max-w-(--skeleton-width) flex-1"
        data-sidebar="menu-skeleton-text"
        style={skeletonStyle}
      />
    </div>
  );
};

const SidebarMenuSub: React.FC<React.ComponentProps<"ul">> = ({ className, ...props }) => {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn(
        "border-border mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5 group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
};

const SidebarMenuSubItem: React.FC<React.ComponentProps<"li">> = ({ className, ...props }) => {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn("group/menu-sub-item relative", className)}
      {...props}
    />
  );
};

const SidebarMenuSubButton: React.FC<
  React.ComponentProps<"a"> & {
    asChild?: boolean;
    size?: "sm" | "md";
    isActive?: boolean;
  }
> = ({ asChild = false, size = "md", isActive = false, className, ...props }) => {
  const Comp: React.ElementType = asChild ? SidebarSlot : "a";

  return (
    <Comp
      data-slot="sidebar-menu-sub-button"
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        "text-foreground-muted hover:bg-muted hover:text-foreground data-[active=true]:bg-muted data-[active=true]:text-foreground flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 outline-none group-data-[collapsible=icon]:hidden focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
        className,
      )}
      {...props}
    />
  );
};

export {
  SIDEBAR_COOKIE_MAX_AGE,
  SIDEBAR_COOKIE_NAME,
  SIDEBAR_KEYBOARD_SHORTCUT,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_ICON,
  SIDEBAR_WIDTH_MOBILE,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
};
