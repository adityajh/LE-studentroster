import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { SelfOnboardForm } from "@/components/onboarding/self-onboard-form"

interface Props {
  params: Promise<{ token: string }>
}

async function getOnboardingData(rawToken: string) {
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
  return prisma.onboardingToken.findUnique({
    where: { tokenHash },
    include: {
      student: {
        include: { program: true, batch: true, documents: true },
      },
    },
  })
}

export default async function OnboardPage({ params }: Props) {
  const { token } = await params
  const record = await getOnboardingData(token)

  if (!record) {
    return (
      <div className="min-h-screen bg-[#160E44] flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-3xl p-10 max-w-md w-full text-center">
          <p className="text-3xl mb-2">🔒</p>
          <h1 className="text-xl font-bold text-white mb-2">Invalid Link</h1>
          <p className="text-slate-300 text-sm">This onboarding link is invalid or has already been used. Please contact your programme coordinator.</p>
        </div>
      </div>
    )
  }

  if (record.expiresAt < new Date()) {
    return (
      <div className="min-h-screen bg-[#160E44] flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-3xl p-10 max-w-md w-full text-center">
          <p className="text-3xl mb-2">⏰</p>
          <h1 className="text-xl font-bold text-white mb-2">Link Expired</h1>
          <p className="text-slate-300 text-sm">This link expired on {record.expiresAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}. Please reach out to your coordinator to get a new link.</p>
        </div>
      </div>
    )
  }

  const s = record.student

  // Legacy students often have `name` populated but no firstName/lastName.
  // Split the full name as a sensible default — the student can correct it.
  const nameParts = s.name?.trim().split(/\s+/) ?? []
  const fallbackFirstName = nameParts[0] ?? ""
  const fallbackLastName = nameParts.slice(1).join(" ")

  const initialData = {
    studentId: s.id,
    name: s.name,
    firstName: s.firstName ?? fallbackFirstName,
    lastName: s.lastName ?? fallbackLastName,
    email: s.email ?? "",
    contact: s.contact ?? "",
    bloodGroup: s.bloodGroup ?? "",
    city: s.city ?? "",
    address: s.address ?? "",
    localAddress: s.localAddress ?? "",
    parent1Name: s.parent1Name ?? "",
    parent1Email: s.parent1Email ?? "",
    parent1Phone: s.parent1Phone ?? "",
    parent2Name: s.parent2Name ?? "",
    parent2Email: s.parent2Email ?? "",
    parent2Phone: s.parent2Phone ?? "",
    localGuardianName: s.localGuardianName ?? "",
    localGuardianPhone: s.localGuardianPhone ?? "",
    localGuardianEmail: s.localGuardianEmail ?? "",
    linkedinHandle: s.linkedinHandle ?? "",
    instagramHandle: s.instagramHandle ?? "",
    universityChoice: s.universityChoice ?? "",
    universityStatus: s.universityStatus ?? "",
    programName: s.program.name,
    batchYear: s.batch.year,
    selfOnboardingStatus: s.selfOnboardingStatus,
    documents: s.documents.map((d) => ({
      id: d.id,
      type: d.type as string,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
    })),
    expiresAt: record.expiresAt.toISOString(),
  }

  return <SelfOnboardForm token={token} initialData={initialData} />
}
