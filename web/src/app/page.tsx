import { redirect } from "next/navigation";

/**
 * `/` sends signed-in users to the dashboard and everyone else to /login
 * (feature map row 1).
 */
export default async function Home() {
  // TODO(Security): const session = await getSession();
  // redirect(session ? "/dashboard" : "/login");
  redirect("/dashboard");
}
