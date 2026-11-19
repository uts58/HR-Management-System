import { NotFoundState } from "@/components/common/not-found-state";

/** Unmatched URLs, rendered without the app shell. */
export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <NotFoundState backHref="/" backLabel="Go to the start page" />
    </main>
  );
}
