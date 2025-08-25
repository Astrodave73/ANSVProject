"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useSidebar } from "./sidebar-context";

function getPageTitle(pathname: string): string {
  switch (pathname) {
    case "/dashboard":
      return "Dashboard Principal";
    case "/dashboard/registro":
      return "Registro de Usuarios";
    case "/dashboard/lectura-qr":
      return "Registro de Acciones Vivenciales En Seguridad Vial Laboral";
    case "/dashboard/resultados":
      return "Resultados y Reportes de JPSVL";
    case "/dashboard/encuesta":
      return "Encuestas";
    default:
      return "Dashboard ANSV";
  }
}

export function TopBar() {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);
  const { isOpen, toggle } = useSidebar();

  return (
    <div
      className={`fixed top-0 border-b border-gray-800 z-30 flex items-center justify-between h-32 bg-gray-900 px-4 sm:px-6 lg:px-12 transition-all duration-300 ${
        isOpen
          ? "left-0 right-0 sm:left-64 sm:right-0" // Mobile: pantalla completa, Desktop: ajustado al sidebar
          : "left-0 right-0" // Sidebar cerrado: margen pequeño desde el borde izquierdo
      }`}
    >
      <div className="flex items-center gap-3 sm:gap-4 lg:gap-6 flex-1 min-w-0">
        <button
          onClick={toggle}
          className="p-2 sm:p-3 rounded-lg bg-slate-400 text-gray-800 hover:bg-slate-300 transition-all duration-200 shadow-md flex-shrink-0"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
        <h1 className="font-bold text-white text-sm sm:text-lg md:text-xl lg:text-2xl xl:text-3xl truncate flex-1 min-w-0 leading-tight">
          {pageTitle}
        </h1>
      </div>

      <div className="hidden sm:flex items-center justify-end space-x-2 md:space-x-4 lg:space-x-6 xl:space-x-8 flex-shrink-0">
        {/* Logo 1 - ANSV */}
        <div className="flex items-center">
          <Image
            src="/images/ANSV-logo-alt.png"
            alt="ANSV Logo"
            width={64}
            height={64}
            className="h-12 sm:h-14 md:h-16 lg:h-20 xl:h-24 2xl:h-28 w-auto object-contain min-h-10 min-w-10 transition-all duration-300 hover:scale-105"
          />
        </div>

        {/* Logo 2 - Universidad de Antioquia */}
        <div className="flex items-center">
          <Image
            src="/images/Udea-logo-bw.png"
            alt="Universidad de Antioquia"
            width={64}
            height={64}
            className="h-12 sm:h-14 md:h-16 lg:h-20 xl:h-24 2xl:h-28 w-auto object-contain min-h-10 min-w-10 transition-all duration-300 hover:scale-105"
          />
        </div>
      </div>
    </div>
  );
}
