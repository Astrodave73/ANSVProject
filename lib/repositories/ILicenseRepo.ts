import type { ID } from "@/lib/domain/types"

export interface ILicenseRepo {
  upsertForUser(params: {
    user_id: ID
    license_number: string
    issued_at: string    // YYYY-MM-DD
    expires_at: string   // YYYY-MM-DD
    restrictions?: string | null
    category_codes: string[]        // p. ej. ["A1","B1","C2"]
  }): Promise<{ license_id: ID; linked: number }>
}
