import { Link, useLocation } from "@tanstack/react-router";

interface NavLinkItem {
  to: "/" | "/community/stalls" | "/admin/comment-drafts" | "/admin/login";
  label: string;
  mobileLabel: string;
  mobileIconClass: string;
}

const navLinks: NavLinkItem[] = [
  {
    to: "/",
    label: "Home",
    mobileLabel: "Home",
    mobileIconClass: "iconify ph--house-line",
  },
  {
    to: "/community/stalls",
    label: "Community",
    mobileLabel: "Community",
    mobileIconClass: "iconify ph--users-three",
  },
  {
    to: "/admin/comment-drafts",
    label: "Admin Drafts",
    mobileLabel: "Drafts",
    mobileIconClass: "iconify ph--stack",
  },
  {
    to: "/admin/login",
    label: "Admin Login",
    mobileLabel: "Login",
    mobileIconClass: "iconify ph--sign-in",
  },
];

export function AppNavHeader() {
  const location = useLocation();

  const isNavItemActive = (to: NavLinkItem["to"]): boolean => {
    if (to === "/") {
      return location.pathname === "/";
    }

    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  return (
    <>
      <header className="border-border bg-surface hidden border-b md:block">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link
            to="/"
            className="font-display hover:text-primary text-sm font-black tracking-tight"
          >
            <span className="text-primary">SG</span> Food Guide
          </Link>

          <nav aria-label="Primary" className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {navLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isNavItemActive(item.to)
                    ? "border-primary bg-primary-surface text-primary"
                    : "border-border bg-surface-card text-foreground-faint hover:border-border-hover hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <nav
        className="border-border bg-surface fixed inset-x-0 bottom-0 z-50 border-t md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Mobile navigation"
      >
        <div className="grid h-14 grid-cols-4">
          {navLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center gap-1 text-xs ${
                isNavItemActive(item.to) ? "text-foreground" : "text-foreground-faint"
              }`}
            >
              <span aria-hidden="true" className={`${item.mobileIconClass} text-base`} />
              <span>{item.mobileLabel}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
