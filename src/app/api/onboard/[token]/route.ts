import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { sendOnboardingSubmittedAlert } from "@/lib/mail"

function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex")
}

async function resolveToken(raw: string) {
  const tokenHash = hashToken(raw)
  return prisma.onboardingToken.findUnique({
    where: { tokenHash },
    include: {
      student: {
        include: { program: true, batch: true, documents: true },
      },
    },
  })
}

// GET — return current student data for pre-fill
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const record = await resolveToken(token)

  if (!record) return NextResponse.json({ error: "Invalid link" }, { status: 404 })
  if (record.expiresAt < new Date()) {
    return NextResponse.json({ error: "This link has expired. Please contact your coordinator." }, { status: 410 })
  }

  const s = record.student
  return NextResponse.json({
    studentId: s.id,
    name: s.name,
    firstName: s.firstName,
    lastName: s.lastName,
    email: s.email,
    contact: s.contact,
    bloodGroup: s.bloodGroup,
    city: s.city,
    address: s.address,
    localAddress: s.localAddress,
    parent1Name: s.parent1Name,
    parent1Email: s.parent1Email,
    parent1Phone: s.parent1Phone,
    parent2Name: s.parent2Name,
    parent2Email: s.parent2Email,
    parent2Phone: s.parent2Phone,
    localGuardianName: s.localGuardianName,
    localGuardianPhone: s.localGuardianPhone,
    localGuardianEmail: s.localGuardianEmail,
    linkedinHandle: s.linkedinHandle,
    instagramHandle: s.instagramHandle,
    universityChoice: s.universityChoice,
    universityStatus: s.universityStatus,
    programName: s.program.name,
    batchYear: s.batch.year,
    selfOnboardingStatus: s.selfOnboardingStatus,
    submittedAt: record.submittedAt,
    documents: s.documents.map((d) => ({
      id: d.id,
      type: d.type,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      uploadedAt: d.uploadedAt,
    })),
    expiresAt: record.expiresAt,
  })
}

// PATCH — save profile data or submit the form
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const record = await resolveToken(token)

  if (!record) return NextResponse.json({ error: "Invalid link" }, { status: 404 })
  if (record.expiresAt < new Date()) {
    return NextResponse.json({ error: "Link expired" }, { status: 410 })
  }
  // Don't allow edits once approved
  if (record.student.selfOnboardingStatus === "APPROVED") {
    return NextResponse.json({ error: "Profile already approved" }, { status: 409 })
  }

  const body = await req.json()
  const { submit, ...profileData } = body

  // Save profile fields
  const allowedFields = [
    "firstName", "lastName", "contact", "bloodGroup",
    "city", "address", "localAddress",
    "parent1Name", "parent1Email", "parent1Phone",
    "parent2Name", "parent2Email", "parent2Phone",
    "localGuardianName", "localGuardianPhone", "localGuardianEmail",
    "linkedinHandle", "instagramHandle",
    "universityChoice", "universityStatus",
  ]

  const updateData: Record<string, string | null> = {}
  for (const field of allowedFields) {
    if (field in profileData) {
      updateData[field] = profileData[field] ?? null
    }
  }

  // Required-fields rule (matches admin onboard wizard + self-onboard form)
  const REQUIRED_DOC_TYPES = ["STUDENT_PHOTO", "AADHAR_CARD", "TWELFTH_MARKSHEET"]
  function findMissing(): string[] {
    const missing: string[] = []
    const eff = (k: string) =>
      ((updateData[k] ?? (record!.student as unknown as Record<string, string | null>)[k]) ?? "")
        .toString()
        .trim()
    if (!eff("parent1Name")) missing.push("Parent / Guardian 1 name")
    if (!eff("parent1Phone")) missing.push("Parent / Guardian 1 phone")
    if (!eff("parent2Name")) missing.push("Parent / Guardian 2 name")
    if (!eff("parent2Phone")) missing.push("Parent / Guardian 2 phone")
    const docTypes = new Set(record!.student.documents.map((d) => d.type))
    for (const t of REQUIRED_DOC_TYPES) {
      if (!docTypes.has(t as typeof docTypes extends Set<infer V> ? V : never)) {
        const labels: Record<string, string> = {
          STUDENT_PHOTO: "Student Photo",
          AADHAR_CARD: "Aadhar Card",
          TWELFTH_MARKSHEET: "12th Marksheet",
        }
        missing.push(labels[t] ?? t)
      }
    }
    return missing
  }

  if (submit) {
    const missing = findMissing()
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Cannot submit — missing required: ${missing.join(", ")}.` },
        { status: 400 }
      )
    }
    // Final submit
    await prisma.student.update({
      where: { id: record.studentId },
      data: {
        ...updateData,
        selfOnboardingStatus: "SUBMITTED",
        selfOnboardingSubmittedAt: new Date(),
      },
    })

    await prisma.onboardingToken.update({
      where: { id: record.id },
      data: { submittedAt: new Date() },
    })

    // Alert the team
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://le-student-roster.vercel.app"
    const notifyEmails = (process.env.ONBOARDING_NOTIFY_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean)
    if (notifyEmails.length) {
      await sendOnboardingSubmittedAlert({
        to: notifyEmails,
        studentName: record.student.name,
        programName: record.student.program.name,
        batchYear: record.student.batch.year,
        studentProfileUrl: `${appUrl}/students/${record.studentId}`,
      })
    }

    return NextResponse.json({ ok: true, submitted: true })
  }

  // Draft save
  await prisma.student.update({
    where: { id: record.studentId },
    data: updateData,
  })

  return NextResponse.json({ ok: true })
}
