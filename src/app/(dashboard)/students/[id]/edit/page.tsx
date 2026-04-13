import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/auth"
import { getStudentById } from "@/lib/students"
import { EditStudentForm } from "@/components/students/edit-student-form"
import { DocumentUpload } from "@/components/students/document-upload"
import { prisma } from "@/lib/prisma"

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const role = (session.user as { role?: string }).role

  const { id } = await params
  const student = await getStudentById(id)
  if (!student) notFound()

  // Fetch the fee schedule for this student's batch (offers + scholarships)
  const feeSchedule = await prisma.feeSchedule.findUnique({
    where: { batchId: student.batchId },
    include: {
      offers: { orderBy: { waiverAmount: "desc" } },
      scholarships: { orderBy: [{ category: "asc" }, { minAmount: "asc" }] },
    },
  })

  // Compute total already paid across all installments
  const totalPaid = student.payments.reduce(
    (sum, p) => sum + p.amount.toNumber(),
    0
  )

  return (
    <div className="max-w-[800px] space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link href="/students" className="text-[10px] uppercase tracking-widest font-bold text-slate-400 hover:text-slate-600">
            Students
          </Link>
          <span className="text-slate-300">/</span>
          <Link href={`/students/${id}`} className="text-[10px] uppercase tracking-widest font-bold text-slate-400 hover:text-slate-600 font-mono">
            {student.rollNo}
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Edit</span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">Edit Student</h1>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Update personal details, contact info, and guardian information.
        </p>
      </div>

      {/* Master details — read only */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-3">Master Details — Read Only</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Roll No",    value: student.rollNo },
            { label: "Batch",      value: `Batch ${student.batch.year}` },
            { label: "Programme",  value: student.program.name },
            { label: "Enrolled",   value: new Date(student.enrollmentDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">{label}</p>
              <p className="text-sm font-bold text-slate-600 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Documents */}
      <div>
        <h2 className="text-base font-extrabold text-slate-800 mb-3">Documents</h2>
        <DocumentUpload
          studentId={student.id}
          documents={student.documents.map((d) => ({
            id: d.id,
            type: d.type,
            fileName: d.fileName,
            fileUrl: d.fileUrl,
            fileSize: d.fileSize,
            uploadedAt: d.uploadedAt,
          }))}
        />
      </div>

      <EditStudentForm
        student={student as any}
        role={role}
        feeSchedule={feeSchedule as any}
        totalPaid={totalPaid}
        program={student.program as any}
      />
    </div>
  )
}
