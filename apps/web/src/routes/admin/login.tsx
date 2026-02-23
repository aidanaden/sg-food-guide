import { Link, createFileRoute } from "@tanstack/react-router";

import { Button } from "@sg-food-guide/ui";

export const Route = createFileRoute("/admin/login")({
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const adminRoutePath = "/admin/comment-drafts";

  const handleCloudflareAccessSignIn = () => {
    window.location.assign(adminRoutePath);
  };

  return (
    <div className="bg-background min-h-screen px-4 py-10">
      <section className="border-border bg-surface-card mx-auto max-w-2xl rounded-2xl border p-6 sm:p-8">
        <h1 className="font-display text-3xl font-black">Admin Login</h1>
        <p className="text-foreground-muted mt-3 text-sm">
          Use Cloudflare Access to authenticate, then continue to the admin review queue.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button type="button" onClick={handleCloudflareAccessSignIn}>
            Sign in with Cloudflare Access
          </Button>
          <Link to="/" className="text-foreground-faint hover:text-primary text-sm">
            Back to home
          </Link>
        </div>

        <p className="text-foreground-faint mt-4 text-xs">
          Access is granted only if your identity is permitted by your Cloudflare Access policy.
        </p>
      </section>
    </div>
  );
}
