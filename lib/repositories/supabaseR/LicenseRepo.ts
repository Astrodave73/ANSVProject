import { supabase } from "@/lib/supabase/client"
import type { ID } from "@/lib/domain/types"
import type { ILicenseRepo } from "../ILicenseRepo"

function sb() {
  if (!supabase) throw new Error("Supabase no está configurado")
  return supabase
}

export class LicenseRepo implements ILicenseRepo {
  async upsertForUser(params: {
    user_id: ID
    license_number: string
    issued_at: string
    expires_at: string
    restrictions?: string | null
    category_codes: string[]
  }): Promise<{ license_id: ID; linked: number }> {
    const { user_id, license_number, issued_at, expires_at, restrictions, category_codes } = params

    // 1) ¿ya existe licencia del usuario?
    const { data: existing, error: selErr } = await sb()
      .from("licenses")
      .select("id")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (selErr) throw selErr

    let license_id: number

    if (existing?.id) {
      // update
      const { data, error } = await sb()
        .from("licenses")
        .update({
          license_number,
          issued_at,
          expires_at,
          restrictions: restrictions ?? null,
        })
        .eq("id", existing.id)
        .select("id")
        .single()
      if (error) throw error
      license_id = data.id
    } else {
      // insert
      const { data, error } = await sb()
        .from("licenses")
        .insert({
          user_id,
          license_number,
          issued_at,
          expires_at,
          restrictions: restrictions ?? null,
        })
        .select("id")
        .single()
      if (error) throw error
      license_id = data.id
    }

    // 2) Resolver IDs de categorías por code
    const codes = (category_codes ?? []).map(c => c.trim().toUpperCase()).filter(Boolean)
    let categoryIds: number[] = []
    if (codes.length) {
      const { data: cats, error: catsErr } = await sb()
        .from("license_categories")
        .select("id, code")
        .in("code", codes)
      if (catsErr) throw catsErr
      categoryIds = (cats ?? []).map(c => c.id)
    }

    // 3) Reemplazar vínculos
    const { error: delErr } = await sb()
      .from("license_category_links")
      .delete()
      .eq("license_id", license_id)
    if (delErr) throw delErr

    let linked = 0
    if (categoryIds.length) {
      const rows = categoryIds.map(cid => ({ license_id, category_id: cid }))
      const { data: links, error: linkErr } = await sb()
        .from("license_category_links")
        .insert(rows)
        .select("category_id")
      if (linkErr) throw linkErr
      linked = links?.length ?? 0
    }

    return { license_id, linked }
  }
}
