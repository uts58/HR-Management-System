import { AppShell } from "@/components/shell/app-shell";

import { PersonaSwitcher } from "../_stubs/persona-switcher";
import { getSessionStub, getStubPersona } from "../_stubs/session";

/**
 * Shell for every signed-in page. Layouts are NOT an auth boundary
 * (ADR-0004 rule 4): each page still calls requireRole/requireSession
 * itself. The layout only reads the session to build the menu.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  // TODO(Security): const session = await requireSession({ onFail: "redirect", allowPendingPasswordChange: true });
  const session = await getSessionStub();
  const persona = await getStubPersona();

  return (
    <AppShell
      user={session.user}
      restricted={session.user.mustChangePassword}
      // TODO(Security): signOutAction={signOut} from "@/auth/actions".
      headerExtra={<PersonaSwitcher current={persona} />}
    >
      {children}
    </AppShell>
  );
}
