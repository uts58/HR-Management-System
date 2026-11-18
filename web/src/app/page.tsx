import { Button } from "@/components/ui/button";

// Placeholder page from the Platform scaffold. Frontend owns this file.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        HR Management System
      </h1>
      <p className="text-muted-foreground">
        New application scaffold. Migration in progress.
      </p>
      <Button>Get started</Button>
    </main>
  );
}
