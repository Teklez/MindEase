"use client";

import dynamic from "next/dynamic";

const AvatarScene = dynamic(
  () => import("@/components/avatar/AvatarScene").then((m) => m.AvatarScene),
  { ssr: false },
);

export default function AvatarPage() {
  return <AvatarScene />;
}
