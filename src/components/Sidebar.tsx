"use client";

import Link from "next/link";
import { UserButton, OrganizationSwitcher } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Settings, ChevronLeft, ChevronRight, Beer, Calendar, Layout, ClipboardList, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";

const navItems = [
  { icon: LayoutDashboard, label: "ダッシュボード", href: "/" },
  { icon: Beer, label: "設備管理", href: "/settings?tab=EQUIPMENT" },
  { icon: Calendar, label: "業務管理", href: "/settings?tab=WORK" },
  { icon: Layout, label: "テンプレート管理", href: "/settings?tab=TEMPLATES" },
  { icon: ClipboardList, label: "タスク管理", href: "/tasks-report" },
  { icon: HelpCircle, label: "マニュアル", href: "/settings?tab=MANUAL" },
  { icon: Settings, label: "設定", href: "/settings?tab=SETTINGS" },
];

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
}

export default function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <aside className={cn(
      "border-r border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl flex flex-col h-full sticky top-0 transition-all duration-300",
      isCollapsed ? "w-20" : "w-64"
    )}>
      <div className={cn("p-6 flex items-center justify-between", isCollapsed && "px-4")}>
        {!isCollapsed && (
          <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Brewery
          </h2>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
      
      <nav className="flex-grow px-3 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const [hrefBase, hrefQuery] = item.href.split("?");
          const hrefParams = new URLSearchParams(hrefQuery);
          let matchedParams = true;
          hrefParams.forEach((val, key) => {
            if (searchParams.get(key) !== val) matchedParams = false;
          });
          
          // Special case for "Settings" - don't highlight if more specific params are present
          if (item.href === "/settings" && searchParams.toString()) {
            matchedParams = false;
          }

          const active = pathname === hrefBase && (!hrefQuery || matchedParams);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                active
                  ? "bg-primary text-white shadow-lg shadow-primary/20"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800",
                isCollapsed && "justify-center px-0"
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span className="font-medium truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={cn("p-4 mt-auto border-t border-slate-200 dark:border-slate-800 flex flex-col gap-4", isCollapsed && "p-2 items-center")}>
        <OrganizationSwitcher 
          hidePersonal={true}
          appearance={{
            elements: {
              rootBox: "w-full",
              organizationSwitcherTrigger: cn(
                "w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-slate-200 dark:border-slate-700",
                isCollapsed && "px-0 justify-center border-none bg-transparent"
              ),
              organizationPreviewTextContainer: isCollapsed ? "hidden" : "block",
              organizationSwitcherTriggerIcon: isCollapsed ? "hidden" : "block"
            }
          }}
        />
        <div className={cn("flex items-center gap-3 px-3", isCollapsed && "px-0 justify-center")}>
          <UserButton 
            appearance={{
              elements: {
                userButtonAvatarBox: "w-9 h-9 border-2 border-primary/20 hover:border-primary/50 transition-all shadow-sm"
              }
            }}
            showName={!isCollapsed}
          />
        </div>
      </div>
    </aside>
  );
}
