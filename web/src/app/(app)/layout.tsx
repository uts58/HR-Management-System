import { getSession } from "@/auth";
import { signOut } from "@/auth/actions";
import { AppShell } from "@/components/shell/app-shell";

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
