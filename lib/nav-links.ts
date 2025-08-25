import {
  ClipboardPenLine,
  ClipboardList,
  QrCode,
  BarChart3,
  DatabaseZap,
  UserPlus,
  type LucideIcon,
  CalendarPlus,
  UserSearch,
  BookCheck,
  BookOpenCheck,
  Download,
} from "lucide-react";

/** Hoja (link normal) */
export type NavLeaf = {
  type: "link";
  href: string;
  label: string;
  icon: LucideIcon;
  /** opcional: estilos extra para el label desde el menú */
  labelClassName?: string;
};

/** Grupo con sublinks */
export type NavGroup = {
  type: "group";
  label: string;
  icon?: LucideIcon;
  items: NavLeaf[];
  /** opcional: abrir el grupo por defecto */
  defaultOpen?: boolean;
};

export type NavItem = NavLeaf | NavGroup;

/** Menú */
export const NAV_LINKS: NavItem[] = [
  {
    type: "group",
    label: "Registro",
    icon: ClipboardPenLine,
    items: [
      {
        type: "link",
        href: "/dashboard/crearevent",
        label: "Crear una Jornada",
        icon: CalendarPlus,
      },
      {
        type: "link",
        href: "/dashboard/registro",
        label: "Registrar Usuario",
        icon: UserPlus,
      },
      {
        type: "link",
        href: "/dashboard/enrolar",
        label: "Usuario ya registrado",
        icon: UserSearch,
      },
    ],
  },

  // 🔻 Resultados como grupo con submódulos
  {
    type: "group",
    label: "Resultados",
    icon: BarChart3,
    defaultOpen: true, // opcional: inicia abierto
    items: [
      {
        type: "link",
        href: "/dashboard/pre-saberes",
        label: "Pre-saberes",
        icon: BookCheck,
      },
      {
        type: "link",
        href: "/dashboard/post-saberes",
        label: "Post-saberes",
        icon: BookOpenCheck,
      },
    ],
  },

  // --- Ítems planos que ya tenías ---
  {
    type: "link",
    href: "/dashboard/encuesta",
    label: "Encuesta",
    icon: ClipboardList,
  },
  {
    type: "link",
    href: "/dashboard/lectura-qr",
    label: "Lectura de QR",
    icon: QrCode,
  },
  {
    type: "link",
    href: "/dashboard/carga-metricas",
    label: "Subir Métricas",
    icon: DatabaseZap,
  },
  {
    type: "link",
    href: "/dashboard/exportar",
    label: "Descargar .xlsx",
    icon: Download,
  },
];

// Alias por compatibilidad con otros imports previos
export const NAV_ITEMS = NAV_LINKS;
