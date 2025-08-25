// lib/repositories/IAttendanceRepo.ts
import { Attendance, ID } from "@/lib/domain/types";

export interface IAttendanceRepo {
  insertOnce(
    user_id: ID,
    simulator_id: number,
    event_id: ID
  ): Promise<{ created: boolean; row: Attendance }>;
}
