import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getEnrollmentFormData } from "@/lib/students"
import { EnrollForm } from "@/components/students/enroll-form"

export default async function NewStudentPage() {
  const session = await auth()
  const dbUser = await prisma.user.findUnique({
    where: { email: session?.user?.email! },
    select: { role: true },
  })

  if (dbUser?.role !== "ADMIN") {
    redirect("/students")
  }

  const batches = await getEnrollmentFormData()
  const defaultTerms = await prisma.systemSetting.findUnique({
    where: { key: "PROPOSAL_TERMS" }
  }).then(s => s?.value || "1. All fees laid out in the structure above must be paid on or before the due date.")

  return (
    <div className="max-w-[800px] space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <a href="/students" className="text-[10px] uppercase tracking-widest font-bold text-slate-400 hover:text-slate-600">
            Students
          </a>
          <span className="text-slate-300">/</span>
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">New</span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">Enroll Student</h1>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Complete the guided onboarding to enroll a new student and generate their proposal.
        </p>
      </div>

      <EnrollForm batches={batches} defaultTerms={defaultTerms} />
    </div>
  )
}
