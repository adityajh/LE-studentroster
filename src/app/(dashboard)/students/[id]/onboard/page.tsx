import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { getStudentById } from "@/lib/students"
import { OnboardWizard } from "@/components/students/onboard-wizard"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/auth"

export default async function OnboardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const student = await getStudentById(id)
  if (!student) notFound()

  // Only ONBOARDING students can be onboarded (wizard transitions them to ACTIVE)
  if (student.status !== "ONBOARDING") {
    redirect(`/students/${id}`)
  }

  const existingDocs = student.documents
    .filter((d) =>
      ["TENTH_MARKSHEET", "TWELFTH_MARKSHEET", "ACCEPTANCE_LETTER", "AADHAR_CARD", "DRIVERS_LICENSE"].includes(d.type)
    )
    .map((d) => ({
      id: d.id,
      type: d.type as "TENTH_MARKSHEET" | "TWELFTH_MARKSHEET" | "ACCEPTANCE_LETTER" | "AADHAR_CARD" | "DRIVERS_LICENSE",
      fileName: d.fileName,
      fileUrl: d.fileUrl,
    }))

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href={`/students/${id}`}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4">
            <ChevronLeft className="w-4 h-4" />
            Back to {student.name}
          </Link>
          <h1 className="text-2xl font-black text-slate-900">Onboard Student</h1>
          <p className="text-slate-500 mt-1">
            Complete the onboarding process for <strong>{student.name}</strong>
            {student.rollNo && <span className="text-slate-400"> · {student.rollNo}</span>}
          </p>
        </div>

        <OnboardWizard
          studentId={student.id}
          studentName={student.name}
          bloodGroup={student.bloodGroup}
          address={student.address}
          localAddress={student.localAddress}
          parent1Name={student.parent1Name}
          parent1Email={student.parent1Email}
          parent1Phone={student.parent1Phone}
          parent2Name={student.parent2Name}
          parent2Email={student.parent2Email}
          parent2Phone={student.parent2Phone}
          localGuardianName={student.localGuardianName}
          localGuardianPhone={student.localGuardianPhone}
          localGuardianEmail={student.localGuardianEmail}
          existingDocs={existingDocs}
          onboardingEmailSentAt={student.onboardingEmailSentAt}
        />
      </div>
    </div>
  )
}
