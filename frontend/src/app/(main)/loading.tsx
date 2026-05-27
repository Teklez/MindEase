import { Loader2 } from "lucide-react";

// Rendered instantly while the next page's RSC payload + chunk are fetched.
// Without this file, navigating in the App Router leaves the old page on
// screen until the new one is fully ready — which feels like the UI is frozen.
// With it, the user sees feedback on the first paint after click.
export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <Loader2
        className="h-5 w-5 animate-spin text-muted-foreground"
        strokeWidth={1.75}
        aria-label="Loading"
      />
    </div>
  );
}
