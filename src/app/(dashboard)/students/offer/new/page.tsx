import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getEnrollmentFormData } from "@/lib/students"
import { CreateOfferForm } from "@/components/students/create-offer-form"

export default async function NewOfferPage() {
  const session = await auth()
  const dbUser = await prisma.user.findUnique({
    where: { email: session?.user?.email! },
    select: { role: true },
  })

  if (dbUser?.role !== "ADMIN") redirect("/students")

  const batches = await getEnrollmentFormData()

  return (
    <div className="max-w-[720px] space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <a href="/students" className="text-[10px] uppercase tracking-widest font-bold text-slate-400 hover:text-slate-600">
            Students
          </a>
          <span className="text-slate-300">/</span>
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">New Offer</span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">Create Offer</h1>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Create a candidate record and send an offer of admission. Enrolment is confirmed after the ₹50,000 registration payment.
        </p>
      </div>

      <CreateOfferForm batches={batches} />
    </div>
  )
}
