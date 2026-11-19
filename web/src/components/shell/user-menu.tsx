"use client";

import {
  ChevronDownIcon,
  KeyRoundIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { SessionUser } from "@/contracts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useTheme, type ThemePreference } from "./theme";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

/**
 * Header user menu: who is signed in, Profile, Change password, theme and
 * Sign out. `restricted` (mustChangePassword) leaves only Sign out, since
 * nothing else is reachable until the password is changed.
 *
 * `signOutAction` is Security's `signOut` server action (AuthActions),
 * passed down from the layout. Until it exists the item just goes to /login.
 */
export function UserMenu({
  user,
  restricted = false,
  signOutAction,
}: {
  user: Pick<SessionUser, "displayName" | "username" | "role">;
  restricted?: boolean;
  signOutAction?: () => Promise<void>;
}) {
  const router = useRouter();
  const [theme, setTheme] = useTheme();
  const [signingOut, startSignOut] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-10 gap-2 px-1.5 sm:px-2"
            aria-label={`Account menu for ${user.displayName}`}
          />
        }
      >
        <Avatar size="sm" className="size-7">
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {initials(user.displayName) || "?"}
          </AvatarFallback>
        </Avatar>
        <span className="hidden max-w-40 truncate text-sm font-medium sm:inline">
          {user.displayName}
        </span>
        <ChevronDownIcon className="hidden opacity-60 sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 py-1.5">
            <span className="truncate text-sm font-medium text-foreground">
              {user.displayName}
            </span>
            <span className="truncate font-normal">
              @{user.username} ·{" "}
              {user.role === "HR_ADMIN" ? "HR admin" : "Employee"}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {!restricted && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href="/profile" />}>
                <UserIcon aria-hidden="true" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/change-password" />}>
                <KeyRoundIcon aria-hidden="true" />
                Change password
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={theme}
            onValueChange={(value: ThemePreference) => setTheme(value)}
          >
            <DropdownMenuRadioItem value="light" closeOnClick={false}>
              <SunIcon aria-hidden="true" />
              Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark" closeOnClick={false}>
              <MoonIcon aria-hidden="true" />
              Dark
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system" closeOnClick={false}>
              <MonitorIcon aria-hidden="true" />
              System
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={signingOut}
          onClick={() =>
            startSignOut(async () => {
              if (signOutAction) {
                await signOutAction();
              }
              // TODO(Security): signOut() should redirect itself; drop this
              // fallback once it is wired.
              router.push("/login");
            })
          }
        >
          <LogOutIcon aria-hidden="true" />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
