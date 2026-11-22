import { redirect } from "next/navigation";

import { getSession } from "@/auth";
import { CHANGE_PASSWORD_PATH, DASHBOARD_PATH, LOGIN_PATH } from "@/auth/paths";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect(LOGIN_PATH);
  redirect(
    session.user.mustChangePassword ? CHANGE_PASSWORD_PATH : DASHBOARD_PATH,
  );
}
