"use client";
import { useState, Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import { cn } from "@/lib/utils";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Suspense fallback={<div className="w-20 bg-white/50 dark:bg-slate-900/50" />}>
        <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      </Suspense>
      <div className={cn(
        "flex-grow min-w-0 overflow-y-auto flex flex-col transition-all duration-300",
        isCollapsed ? "pl-2 py-2 pr-0" : "pl-4 py-4 pr-0 md:pl-8 md:py-8 md:pr-0"
      )}>
        {children}
      </div>
    </div>
  );
}
