"use client";

import { createContext, useContext, useState } from "react";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { GroupsSidebar } from "@/components/groups/GroupsSidebar";

// --- mobile sidebar context: lets child pages open the sheet from their header

interface GroupsLayoutContextValue {
  openSidebar: () => void;
  closeSidebar: () => void;
}

const GroupsLayoutContext = createContext<GroupsLayoutContextValue | null>(null);

export function useGroupsLayout(): GroupsLayoutContextValue {
  const ctx = useContext(GroupsLayoutContext);
  if (!ctx) return { openSidebar: () => {}, closeSidebar: () => {} };
  return ctx;
}

/** Hamburger that opens the sidebar Sheet. Hidden on lg+ where the sidebar is permanent. */
export function MobileGroupsTrigger() {
  const { openSidebar } = useGroupsLayout();
  return (
    <button
      type="button"
      onClick={openSidebar}
      aria-label="Open groups list"
      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:hidden"
    >
      <Menu className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}

/**
 * Shared layout for the unified Groups surface.
 *
 *   ≥ lg (1024px)  →  [GroupsSidebar 300px] [active page main slot]
 *   < lg           →  [active page only], sidebar opens as a Sheet from a
 *                     hamburger button (MobileGroupsTrigger) inside the page.
 */
export default function GroupsLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("groups");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <GroupsLayoutContext.Provider
      value={{
        openSidebar: () => setMobileSidebarOpen(true),
        closeSidebar: () => setMobileSidebarOpen(false),
      }}
    >
      <div className="flex h-[calc(100dvh-4rem)] min-h-0 bg-secondary/30">
        <aside className="hidden h-full w-[300px] min-h-0 shrink-0 border-r border-border bg-background lg:flex lg:flex-col">
          <GroupsSidebar />
        </aside>
        <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-[320px] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{t("title")}</SheetTitle>
          </SheetHeader>
          <GroupsSidebar onNavigate={() => setMobileSidebarOpen(false)} />
        </SheetContent>
      </Sheet>
    </GroupsLayoutContext.Provider>
  );
}
