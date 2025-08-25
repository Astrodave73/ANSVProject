// lib/services/RegisterUserService.ts
import { IUserRepo } from "../repositories/IUserRepo"
import type { ILicenseRepo } from "../repositories/ILicenseRepo"
import { ValidationError } from "../domain/errors"
import type { User } from "../domain/types"
import { ROAD_USER } from "../domain/types"

export class RegisterUserService {
  constructor(private users: IUserRepo, private licenses?: ILicenseRepo) {}

  // EXISTENTE: no tocar
  async registerMinimal(input: {
    name: string
    lastname: string
    doc_type: number
    doc_number: string
    email?: string | null
  }): Promise<User> {
    if (!input.name || !input.lastname || !input.doc_type || !input.doc_number) {
      throw new ValidationError("Faltan campos obligatorios")
    }
    const qr_code = crypto.randomUUID()
    return this.users.create({ ...input, qr_code })
  }

  // NUEVO: opcionalmente guarda licencia si road_user_type = conductor
  async registerWithRoadUserAndOptionalLicense(input: {
    name: string
    lastname: string
    doc_type: number
    doc_number: string
    email?: string | null
    road_user_type: 1 | 2 | 3 // 1 peatón, 2 ciclista, 3 conductor
    license?: {
      issued_at: string        // YYYY-MM-DD
      expires_at: string       // YYYY-MM-DD
      restrictions?: string | null
      category_codes: string[] // ["A1","B1",...]
      license_number?: string  // opcional (fallback doc_number)
    }
  }): Promise<User> {
    const { name, lastname, doc_type, doc_number, road_user_type } = input
    if (!name || !lastname || !doc_type || !doc_number) {
      throw new ValidationError("Faltan campos obligatorios")
    }

    const qr_code = crypto.randomUUID()
    const user = await this.users.create({
      name,
      lastname,
      doc_type,
      doc_number,
      email: input.email ?? null,
      qr_code,
      road_user_type, // 👈 guardamos el tipo de usuario
    })

    // Guardar licencia SOLO si es conductor y hay repo de licencias
    if (road_user_type === ROAD_USER.driver && input.license && this.licenses) {
      const { issued_at, expires_at, restrictions, category_codes, license_number } = input.license
      if (issued_at && expires_at) {
        const numberToUse = (license_number?.trim() || doc_number).toString()
        try {
          await this.licenses.upsertForUser({
            user_id: user.id,
            license_number: numberToUse,
            issued_at,
            expires_at,
            restrictions: restrictions ?? null,
            category_codes: (category_codes ?? []).map(c => c.toUpperCase()),
          })
        } catch (e) {
          console.error("[RegisterUserService] license upsert failed:", e)
          // no interrumpimos el alta del usuario
        }
      }
    }

    return user
  }
}
