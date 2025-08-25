import Link from "next/link";
import { UserPlus, QrCode, BarChart3, ClipboardList, DatabaseZap, CalendarPlus, UserSearch, Download } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-4xl font-bold text-white mb-2">
          Bienvenido al Dashboard
        </h1>
        <p className="text-gray-400 text-lg">
          Gestiona tus operaciones desde un solo lugar
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link
          href="/dashboard/crearevent"
          className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-primary hover:bg-gray-750 transition-all cursor-pointer block group"
        >
          <div className="flex flex-col items-center text-center">
            <h3 className="text-lg font-semibold text-white group-hover:text-primary transition-colors mb-3">
              Crear una Jornada
            </h3>
            <CalendarPlus className="h-16 w-16 text-slate-400 group-hover:text-primary transition-colors" />
          </div>
        </Link>
        <Link
          href="/dashboard/registro"
          className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-primary hover:bg-gray-750 transition-all cursor-pointer block group"
        >
          <div className="flex flex-col items-center text-center">
            <h3 className="text-lg font-semibold text-white group-hover:text-primary transition-colors mb-3">
              Registrar Usuario
            </h3>
            <UserPlus className="h-16 w-16 text-slate-400 group-hover:text-primary transition-colors" />
          </div>
        </Link>
        <Link
          href="/dashboard/carga-metricas"
          className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-primary hover:bg-gray-750 transition-all cursor-pointer block group"
        >
          <div className="flex flex-col items-center text-center">
            <h3 className="text-lg font-semibold text-white group-hover:text-primary transition-colors mb-3">
              Usuario ya Registrado
            </h3>
            <UserSearch className="h-16 w-16 text-slate-400 group-hover:text-primary transition-colors" />
          </div>
        </Link>

        <Link
          href="/dashboard/resultados"
          className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-primary hover:bg-gray-750 transition-all cursor-pointer block group"
        >
          <div className="flex flex-col items-center text-center">
            <h3 className="text-lg font-semibold text-white group-hover:text-primary transition-colors mb-3">
              Resultados
            </h3>
            <BarChart3 className="h-16 w-16 text-slate-400 group-hover:text-primary transition-colors" />
          </div>
        </Link>

        <Link
          href="/dashboard/encuesta"
          className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-primary hover:bg-gray-750 transition-all cursor-pointer block group"
        >
          <div className="flex flex-col items-center text-center">
            <h3 className="text-lg font-semibold text-white group-hover:text-primary transition-colors mb-3">
              Encuestas
            </h3>
            <ClipboardList className="h-16 w-16 text-slate-400 group-hover:text-primary transition-colors" />
          </div>
        </Link>
        <Link
          href="/dashboard/lectura-qr"
          className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-primary hover:bg-gray-750 transition-all cursor-pointer block group"
        >
          <div className="flex flex-col items-center text-center">
            <h3 className="text-lg font-semibold text-white group-hover:text-primary transition-colors mb-3">
              Escanear QR
            </h3>
            <QrCode className="h-16 w-16 text-slate-400 group-hover:text-primary transition-colors" />
          </div>
        </Link>
        <Link
          href="/dashboard/carga-metricas"
          className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-primary hover:bg-gray-750 transition-all cursor-pointer block group"
        >
          <div className="flex flex-col items-center text-center">
            <h3 className="text-lg font-semibold text-white group-hover:text-primary transition-colors mb-3">
              Subir Métricas
            </h3>
            <DatabaseZap className="h-16 w-16 text-slate-400 group-hover:text-primary transition-colors" />
          </div>
        </Link>
        
        <Link
          href="/dashboard/exportar"
          className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-primary hover:bg-gray-750 transition-all cursor-pointer block group"
        >
          <div className="flex flex-col items-center text-center">
            <h3 className="text-lg font-semibold text-white group-hover:text-primary transition-colors mb-3">
              Descargar .xlsx
            </h3>
            <Download className="h-16 w-16 text-slate-400 group-hover:text-primary transition-colors" />
          </div>
        </Link>
        <Link
          href="/dashboard/reimprimir-carnet"
          className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-primary hover:bg-gray-750 transition-all cursor-pointer block group"
        >
          <div className="flex flex-col items-center text-center">
            <h3 className="text-lg font-semibold text-white group-hover:text-primary transition-colors mb-3">
              Reimprimir Carnet
            </h3>
            <Download className="h-16 w-16 text-slate-400 group-hover:text-primary transition-colors" />
          </div>
        </Link>
      </div>
    </div>
  );
}
