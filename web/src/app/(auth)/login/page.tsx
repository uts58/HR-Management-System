import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

/**
 * Login (feature map rows 1–2). Layout by Frontend; the form logic is
 * Security's. [CHANGE] No notices here: they moved behind login.
 */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // TODO(Security): const session = await getSession(); if (session) redirect("/dashboard");
  const { callbackUrl } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          <h1>Sign in</h1>
        </CardTitle>
        <CardDescription>
          Use the username and password from your HR administrator.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm
          callbackUrl={typeof callbackUrl === "string" ? callbackUrl : null}
        />
      </CardContent>
    </Card>
  );
}
