-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('STUDENT_PHOTO', 'TENTH_MARKSHEET', 'TWELFTH_MARKSHEET', 'ACCEPTANCE_LETTER', 'AADHAR_CARD', 'DRIVERS_LICENSE');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'CHEQUE', 'NEFT', 'UPI', 'RTGS', 'OTHER');

-- AlterEnum
ALTER TYPE "InstallmentStatus" ADD VALUE 'PARTIAL';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "address" TEXT,
ADD COLUMN     "bloodGroup" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "localAddress" TEXT,
ADD COLUMN     "localGuardianEmail" TEXT,
ADD COLUMN     "localGuardianName" TEXT,
ADD COLUMN     "localGuardianPhone" TEXT,
ADD COLUMN     "parent1Email" TEXT,
ADD COLUMN     "parent1Name" TEXT,
ADD COLUMN     "parent1Phone" TEXT,
ADD COLUMN     "parent2Email" TEXT,
ADD COLUMN     "parent2Name" TEXT,
ADD COLUMN     "parent2Phone" TEXT,
ALTER COLUMN "contact" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateTable
CREATE TABLE "StudentDocument" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,

    CONSTRAINT "StudentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "installmentId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payerName" TEXT,
    "paymentMode" "PaymentMode",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "Installment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
