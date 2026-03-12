"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";
import { getStoredToken } from "@/lib/api";
import ChatContainer from "@/components/chat/ChatContainer";

export default function ChatRoomPage() {
  const router = useRouter();
  const params = useParams();
  const conversationId = params?.conversationId as string;

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }
  }, [router]);

  if (!conversationId) return null;

  return (
    <div className="flex h-full flex-col bg-background">
      <ChatContainer conversationId={conversationId} />
    </div>
  );
}
