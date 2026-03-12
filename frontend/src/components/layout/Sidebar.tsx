"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import SidebarContent from "./SidebarContent";

const SIDEBAR_WIDTH = 280;
const SIDEBAR_COLLAPSED_WIDTH = 60;

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col shrink-0 border-r border-border bg-muted/50 transition-[width] duration-200 ease-in-out h-full"
      )}
      style={{ width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
    >
      <SidebarContent collapsed={collapsed} onCollapseToggle={() => setCollapsed((c) => !c)} />
    </aside>
  );
}
