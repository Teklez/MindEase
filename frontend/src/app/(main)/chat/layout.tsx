"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { ConversationsProvider } from "@/contexts/ConversationsContext";
import ChatSidebar from "@/components/chat/ChatSidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("chat");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <ConversationsProvider>
    <div className="flex h-full min-h-0 flex-1 flex-col md:flex-row">
      {/* Desktop: sidebar on the left */}
      <div className="hidden md:flex h-full min-h-0 flex-col shrink-0">
        <ChatSidebar />
      </div>

      {/* Chat content area */}
      <div className="flex min-h-0 flex-1 flex-col min-w-0">
        {/* Mobile: bar with menu to open conversation list */}
        <div className="flex md:hidden shrink-0 items-center border-b border-border bg-background px-2 py-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("openConversationList")}
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col min-w-0">
          {children}
        </div>
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
