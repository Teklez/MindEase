import { Skeleton } from "@/components/ui/skeleton";

// Skeleton shown instantly while /groups/[groupId] mounts. Mirrors the room
// shape: header bar, message list, members rail, composer — so the layout
// doesn't visibly shift when the real page finishes loading.
export default function GroupRoomLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
        <Skeleton className="h-5 w-5 rounded-md" />
        <Skeleton className="h-5 w-40 rounded-md" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex flex-1 min-h-0 flex-col">
          <div className="flex-1 overflow-hidden p-4">
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              <Skeleton className="mx-auto h-4 w-24 rounded-full" />
              <div className="flex max-w-[78%] flex-col gap-1">
                <Skeleton className="h-3 w-20 rounded-md" />
                <Skeleton className="h-14 w-72 rounded-2xl" />
              </div>
              <div className="ml-auto flex max-w-[78%] flex-col items-end gap-1">
                <Skeleton className="h-3 w-16 rounded-md" />
                <Skeleton className="h-10 w-56 rounded-2xl" />
              </div>
              <div className="flex max-w-[78%] flex-col gap-1">
                <Skeleton className="h-3 w-20 rounded-md" />
                <Skeleton className="h-20 w-80 rounded-2xl" />
              </div>
              <div className="ml-auto flex max-w-[78%] flex-col items-end gap-1">
                <Skeleton className="h-3 w-16 rounded-md" />
                <Skeleton className="h-8 w-40 rounded-2xl" />
              </div>
            </div>
          </div>
          <div className="border-t border-border bg-background p-4">
            <Skeleton className="mx-auto h-12 max-w-3xl rounded-md" />
          </div>
        </div>

        <aside className="hidden w-64 shrink-0 border-l border-border bg-background/50 p-4 lg:block">
          <Skeleton className="h-4 w-24 rounded-md" />
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 flex-1 rounded-md" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 flex-1 rounded-md" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 flex-1 rounded-md" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 flex-1 rounded-md" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
