-- AlterTable
ALTER TABLE "ReminderLog" ADD COLUMN     "readAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ReminderSetting" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "daysOut" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReminderSetting_type_key" ON "ReminderSetting"("type");
