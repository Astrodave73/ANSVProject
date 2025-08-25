"use client";

import type React from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopBar } from "@/components/dashboard/top-bar";
import {
  SidebarProvider,
  useSidebar,
} from "@/components/dashboard/sidebar-context";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isOpen } = useSidebar();

  return (
    <div className="h-screen bg-black overflow-hidden">
      <Sidebar />
      <TopBar />
      <main
        className={`transition-all duration-300 h-full bg-gradient-to-br from-gray-900 to-black ${
          isOpen ? "ml-64" : "ml-0"
        }`}
      >
        <div className="h-full pt-32 overflow-y-auto">
          <div className="p-4 sm:p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <DashboardContent>{children}</DashboardContent>
    </SidebarProvider>
  );
}
