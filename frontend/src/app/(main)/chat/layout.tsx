"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { ConversationsProvider } from "@/contexts/ConversationsContext";
import ChatSidebar from "@/components/chat/ChatSidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("chat");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <ConversationsProvider>
      <div className="grid h-[calc(100vh-60px)] grid-cols-1 lg:grid-cols-[280px_1fr]">
        {/* Desktop sidebar */}
        <div className="hidden h-full min-h-0 lg:block">
          <ChatSidebar />
        </div>

        {/* Mobile chrome + main column */}
        <div className="flex min-h-0 min-w-0 flex-col bg-secondary/40">
          <div className="flex shrink-0 items-center border-b border-border bg-background px-3 py-2 lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("openConversationList")}
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" strokeWidth={1.75} />
            </Button>
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        </div>

        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent side="left" className="w-[280px] p-0">
            <div className="h-full overflow-hidden">
              <ChatSidebar onNavigate={() => setMobileSidebarOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </ConversationsProvider>
  );
}
