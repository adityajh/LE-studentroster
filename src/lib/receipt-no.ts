/**
 * Receipt-number generation.
 *
 * Stored on Payment.receiptNo at create time so the number is stable and
 * queryable. Format: `RCP-{rollNoOrStudentSuffix}-{6 base-36 chars}`.
 *
 * The 6-char suffix is derived from a fresh nanoid-style randomly-generated
 * string (uppercase, base-36) rather than the payment.id to avoid leaking
 * cuid internals and to give us a short, displayable token that's still
 * collision-resistant in combination with the per-student prefix.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

function randomSuffix(len = 6): string {
  let out = ""
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return out
}

export function generateReceiptNo(opts: { rollNo: string | null; studentId: string }): string {
  const prefix = opts.rollNo ?? opts.studentId.slice(-6).toUpperCase()
  return `RCP-${prefix}-${randomSuffix()}`
}
