// Single source of truth for user roles.
// Update here to change labels, descriptions, or add new roles.
// The Role enum in prisma/schema.prisma must stay in sync.

export const ROLES = {
  ADMIN: {
    value: "ADMIN" as const,
    label: "Admin",
    description: "Full access — manage team, settings, batches & programs, delete students, override financials, modify installments, make offers, enrol students, do onboarding, record payments, and upload documents.",
  },
  STAFF: {
    value: "STAFF" as const,
    label: "Staff",
    description: "Can make offers, enrol students, do onboarding, record payments, and upload documents. Cannot manage team, settings, batches/programs, delete students, or modify financial overrides.",
  },
} satisfies Record<string, { value: string; label: string; description: string }>

export type AppRole = keyof typeof ROLES   // "ADMIN" | "STAFF"
export const ROLE_VALUES = Object.values(ROLES).map((r) => r.value) as AppRole[]
