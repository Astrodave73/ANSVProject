// lib/repositories/supabaseR/UserRepo.ts
import { supabase } from "../../supabase/client";
import { IUserRepo } from "../IUserRepo";
import type { User } from "../../domain/types";

function sb() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export class UserRepo implements IUserRepo {
  async findByQR(qr: string): Promise<User | null> {
    const { data, error } = await sb()
      .from("users_table")
      .select("id, name, lastname, email, doc_type, doc_number, qr_code")
      .eq("qr_code", qr)
      .maybeSingle();

    // PGRST116 = no rows; maybeSingle ya devuelve null sin lanzar
    if (error && (error as any).code !== "PGRST116") throw error;
    return (data as User) ?? null;
  }

  async getByDoc(doc_type: number, doc_number: string): Promise<User | null> {
    const { data, error } = await sb()
      .from("users_table")
      .select("id, name, lastname, email, doc_type, doc_number, qr_code")
      .eq("doc_type", doc_type)
      .eq("doc_number", doc_number)
      .maybeSingle();

    if (error && (error as any).code !== "PGRST116") throw error;
    return (data as User) ?? null;
  }

  async create(u: Partial<User>): Promise<User> {
    const { data, error } = await sb()
      .from("users_table")
      .insert(u)
      .select("*")
      .single();

    if (error) throw error;
    return data as User;
  }
}
