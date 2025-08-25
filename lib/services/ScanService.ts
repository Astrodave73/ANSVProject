// lib/services/ScanService.ts
import { UserRepo } from "../repositories/supabaseR/UserRepo";
import { AttendanceRepo } from "../repositories/supabaseR/AttendanceRepo";
import { SimulatorRepo } from "../repositories/supabaseR/SimulatorRepo";
import { EventRepo } from "../repositories/supabaseR/EventRepo";

const users = new UserRepo();
const att = new AttendanceRepo();
const sims = new SimulatorRepo();
const events = new EventRepo();

function todayInBogota(): string {
  // YYYY-MM-DD en TZ America/Bogota → matchea events_table.event_date (DATE)
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export const ScanService = {
  async verifySimulatorId(simulatorId: number) {
    return sims.exists(simulatorId);
  },

  /**
   * Escaneo "solo QR + simulador"
   * - Resuelve evento automáticamente usando el ÚLTIMO enrolamiento de HOY.
   * - Garantiza no duplicar simulador de por vida (insertOnce en repo/DB).
   */
  async scanByQr(params: { qr: string; simulatorId: number }) {
    const { qr, simulatorId } = params;

    // 1) usuario por QR
    const user = await users.findByQR(qr);
    if (!user) {
      return {
        status: "not_found" as const,
        message: "QR no corresponde a ningún usuario",
      };
    }

    // 2) simulador existe
    const exists = await sims.exists(simulatorId);
    if (!exists) {
      return {
        status: "error" as const,
        message: `Simulador ${simulatorId} no existe`,
        user,
      };
    }

    // 3) evento del día (último enrolamiento hoy)
    const todayStr = todayInBogota();
    const picked = await events.pickEventForScan(user.id, todayStr);


if (!picked.event) {
  return {
    status: "error" as const,
    message: "Usuario no está enrolado en ningún evento de HOY",
    user,
  };
}

    // 4) registrar asistencia UNA SOLA VEZ por simulador (de por vida)
    const result = await att.insertOnce(user.id, simulatorId, picked.event.id);
    if (!result.created) {
      return {
        status: "duplicate" as const,
        message: "Este usuario ya realizó este simulador anteriormente",
        user,
        event_id: picked.event.id,
      };
    }

    return {
      status: "ok" as const,
      message: "Asistencia registrada",
      user,
      event_id: picked.event.id,
    };
  },
};
