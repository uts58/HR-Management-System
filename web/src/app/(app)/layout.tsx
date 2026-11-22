import { getSession } from "@/auth";
import { signOut } from "@/auth/actions";
import { AppShell } from "@/components/shell/app-shell";

/**
 * Shell for every signed-in page. Layouts are NOT an auth boundary
 * (ADR-0004 rule 4): each page calls requireRole/requireSession itself.
 * The layout only reads the session to build the menu. Without a session
 * it renders the page bare, and the page's own guard redirects to /login.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  if (!session) return <>{children}</>;

  return (
    <AppShell
      user={session.user}
      restricted={session.user.mustChangePassword}
      signOutAction={signOut}
    >
      {children}
    </AppShell>
  );
}
