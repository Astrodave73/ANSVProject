"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, X, ChevronRight, ChevronDown } from "lucide-react";
import { useSidebar } from "./sidebar-context";
import { NAV_ITEMS, type NavItem, type NavGroup, type NavLeaf } from "@/lib/nav-links";


// helpers
const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(href + "/");

const groupIsActive = (pathname: string, group: NavGroup) =>
  group.items.some((it) => isActive(pathname, it.href));

// subcomponent: link
function SidebarLink({ item, active }: { item: NavLeaf; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group w-full sm:justify-start justify-center",
        active ? "bg-primary text-white shadow-lg" : "text-gray-300 hover:bg-gray-800 hover:text-white"
      )}
    >
      <Icon className={cn("w-5 h-5 transition-colors", active ? "text-white" : "text-gray-400 group-hover:text-primary")} />
      <span className="font-xs whitespace-wrap">{item.label}</span>
    </Link>
  );
}

// subcomponent: grupo
function SidebarGroupUI({
  group,
  pathname,
  defaultOpen,
}: {
  group: NavGroup;
  pathname: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  const active = groupIsActive(pathname, group);

  const HeaderIcon = group.icon;
  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
          (active || open) ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
        )}
        aria-expanded={open}
        aria-controls={`group-${group.label}`}
      >
        {HeaderIcon ? (
          <HeaderIcon className={cn("w-5 h-5", active ? "text-primary" : "text-gray-400")} />
        ) : null}
        <span className="font-medium flex-1 text-left whitespace-nowrap">{group.label}</span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>

      <div
        id={`group-${group.label}`}
        className={cn(
          "overflow-hidden transition-[grid-template-rows] duration-200 grid",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0">
          <div className="pl-4 mt-2 space-y-1 border-l border-gray-800">
            {group.items.map((child) => (
              <SidebarLink key={child.href} item={child} active={isActive(pathname, child.href)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { isOpen, toggle } = useSidebar();

  // no anotar tipo en el map; mantenlo tipado aquí
  const items = useMemo<NavItem[]>(() => NAV_ITEMS, []);

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300" onClick={toggle} />
      )}

      <div
        className={cn(
          "fixed left-0 top-0 bg-gray-900 border-r border-gray-800 transition-all duration-300 z-50",
          "h-full",
          isOpen ? "w-full sm:w-64" : "w-0"
        )}
      >
        <div className={cn("h-full transition-opacity duration-200 flex flex-col", isOpen ? "opacity-100" : "opacity-0")}>
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <h2 className="text-white font-semibold text-lg">Menú</h2>
            <button
              onClick={toggle}
              className="p-2 rounded-lg bg-slate-400 text-gray-800 hover:bg-slate-300 transition-all duration-200 shadow-md"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navegación */}
          <nav className="p-4 space-y-2 flex-1 sm:items-start items-center flex flex-col sm:block sm:justify-start justify-center">
            <div className="w-full max-w-xs sm:max-w-none space-y-2">
              {/* Inicio */}
              <Link
                href="/dashboard"
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group w-full sm:justify-start justify-center",
                  pathname === "/dashboard" ? "bg-primary text-white shadow-lg" : "text-gray-300 hover:bg-gray-800 hover:text-white"
                )}
              >
                <Home className={cn("w-5 h-5 transition-colors", pathname === "/dashboard" ? "text-white" : "text-gray-400 group-hover:text-primary")} />
                <span className="font-medium whitespace-nowrap">Inicio</span>
              </Link>

              {/* Items / Grupos */}
              {items.map((it) =>
                it.type === "link" ? (
                  <SidebarLink key={it.href} item={it} active={isActive(pathname, it.href)} />
                ) : (
                  <SidebarGroupUI
                    key={it.label}
                    group={it}
                    pathname={pathname}
                    defaultOpen={groupIsActive(pathname, it)}
                  />
                )
              )}
            </div>
          </nav>

          {/* Logos (mobile) */}
          <div className="p-4 border-t border-gray-800 mt-auto sm:hidden">
            <div className="flex flex-row items-center justify-center pb-5 tracking-normal space-x-8">
              <div className="flex items-center">
                <Image
                  src="/images/ANSV-logo-alt.png"
                  alt="ANSV Logo"
                  width={120}
                  height={120}
                  className="h-[7vh] w-auto object-contain min-h-[100px] max-h-[200px]"
                />
              </div>
              <div className="flex items-center">
                <Image
                  src="/images/Udea-logo-bw.png"
                  alt="Universidad de Antioquia"
                  width={120}
                  height={120}
                  className="h-[7vh] w-auto object-contain min-h-[100px] max-h-[200px]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
