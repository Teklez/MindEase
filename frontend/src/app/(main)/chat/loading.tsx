import { Skeleton } from "@/components/ui/skeleton";

// Skeleton shown instantly while /chat (the empty-state landing page) mounts.
// Mirrors the page's hero + starter-prompts + composer layout so the page
// appears to "snap in" rather than pop from a blank screen.
export default function ChatLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <section className="relative grid flex-1 place-items-center overflow-hidden bg-gradient-to-b from-background to-secondary/40 p-4 sm:p-6 md:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary opacity-35 blur-3xl"
        />
        <div className="relative w-full max-w-[640px] text-center">
          <Skeleton className="mx-auto h-14 w-14 rounded-xl" />
          <Skeleton className="mx-auto mt-5 h-10 w-[70%] rounded-md" />
          <Skeleton className="mx-auto mt-3 h-4 w-[40%] rounded-md" />
          <div className="mx-auto mt-8 grid max-w-[560px] grid-cols-1 gap-2 sm:grid-cols-2">
            <Skeleton className="h-12 rounded-md" />
            <Skeleton className="h-12 rounded-md" />
            <Skeleton className="h-12 rounded-md" />
            <Skeleton className="h-12 rounded-md" />
          </div>
        </div>
      </section>
      <div className="border-t border-border bg-background p-4">
        <Skeleton className="mx-auto h-12 max-w-3xl rounded-md" />
      </div>
    </div>
  );
}
