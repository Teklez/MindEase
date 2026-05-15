"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { getConversation } from "@/lib/api";
import type { Conversation } from "@/lib/types";

const AvatarScene = dynamic(
  () => import("@/components/avatar/AvatarScene").then((m) => m.AvatarScene),
  { ssr: false },
);

function AvatarPageInner() {
  const params = useSearchParams();
  const continueId = params.get("conversation");
  const [preselectPersonaId, setPreselectPersonaId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!continueId);

  useEffect(() => {
    if (!continueId) return;
    (async () => {
      const res = await getConversation(continueId);
      if (res.ok) {
        const c = res.data as unknown as Conversation;
        if (c.attrs?.persona_id) {
          setPreselectPersonaId(c.attrs.persona_id);
        }
      }
      setLoaded(true);
    })();
  }, [continueId]);

  if (!loaded) return null;
  return (
    <AvatarScene
      preselectPersonaId={preselectPersonaId ?? undefined}
      continueConversationId={continueId ?? undefined}
    />
  );
}

export default function AvatarPage() {
  return (
    <Suspense fallback={null}>
      <AvatarPageInner />
    </Suspense>
  );
}
