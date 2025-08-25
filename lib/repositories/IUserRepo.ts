// lib/repositories/IUserRepo.ts
import type { User } from "@/lib/domain/types";

export interface IUserRepo {
  findByQR(qr: string): Promise<User | null>;
  getByDoc(doc_type: number, doc_number: string): Promise<User | null>;
  create(u: Partial<User>): Promise<User>;
}
