// lib/domain/types.ts
export type ID = number;

export interface User {
  id: ID;
  qr_code: string;
  name?: string | null;
  lastname?: string | null;
  company_name?: string | null;
  arl?: string | null;
  gender_id?: number | null;
  birthdate?: string | null;
  doc_type?: number | null;
  doc_number?: string | null;
  phone_number?: string | null;
  email?: string | null;
  photo_url?: string | null;
  registered_at: string;
  road_user_type?: 1 | 2 | 3 | null;
}

export interface Event {
  id: ID;
  department_id: number;
  municipality_id: number;
  event_date: string; // YYYY-MM-DD
  name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface Simulator {
  id: number; // 1..9
  name: string;
}

export interface Attendance {
  id: ID;
  user_id: ID;
  event_id: ID;
  simulator_id: number;
  attended_at: string; // ISO
}

// input models
export interface CreateEventInput {
  department_id: number;
  municipality_id: number;
  name?: string;
  event_date?: string;
}

export type License = {
  id: number
  user_id: number
  license_number: string
  issued_at: string   // YYYY-MM-DD
  expires_at: string  // YYYY-MM-DD
  restrictions: string | null
  created_at: string
}

export type LicenseCategory = {
  id: number
  code: string
  name: string | null
}

export type RoadUserType = 1 | 2 | 3; // 1 peaton, 2 ciclista, 3 conductor
export const ROAD_USER = {
  pedestrian: 1 as RoadUserType,
  cyclist: 2 as RoadUserType,
  driver: 3 as RoadUserType,
};

// Mapa UI -> códigos de la tabla license_categories
export const LICENSE_CATEGORY_CODE: Record<string, string> = {
  // Etiquetas de tu UI -> códigos estándar
  "A1 - Motocicletas hasta 125cc": "A1",
  "A2 - Motocicletas más de 125cc": "A2",
  "Automóviles, camperos, camionetas": "B1",
  "Camiones rígidos, buses": "B2",
  "Vehículos articulados": "B3",
  "Taxi": "C1",
  "Transporte público colectivo": "C2",
  "Transporte público masivo": "C3",
};