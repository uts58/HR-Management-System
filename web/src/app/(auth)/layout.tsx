import { Brand } from "@/components/shell/brand";

/** Centred card layout for anonymous pages (login). No app navigation. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main
      id="main-content"
      className="flex min-h-svh flex-1 flex-col items-center justify-center gap-8 bg-muted/40 px-4 py-10"
    >
      <Brand />
      <div className="w-full max-w-sm">{children}</div>
      <p className="text-xs text-muted-foreground">
        Need access? Ask your HR administrator for an account.
      </p>
    </main>
  );
}
