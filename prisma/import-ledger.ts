import fs from "fs"
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
dotenv.config()

import { PrismaClient } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"

const CSV_PATH = "/Users/adityajhunjhunwala/Documents/Antigravity/StudentRoster/LE-Student-Fee-FINAL.xlsx - StudentLedger.csv"

async function main() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || ""
  const adapter = new PrismaNeon({ connectionString })
  const prisma = new PrismaClient({ adapter })

  console.log("Starting student ledger import...")

  if (!fs.existsSync(CSV_PATH)) {
    console.error("CSV file not found at:", CSV_PATH)
    process.exit(1)
  }

  const csvContent = fs.readFileSync(CSV_PATH, "utf-8")
  const lines = csvContent.split("\n")

  function parseCsvLine(line: string) {
    const result = []
    let current = ""
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') inQuotes = !inQuotes
        else if (char === "," && !inQuotes) {
            result.push(current.trim())
            current = ""
        } else current += char
    }
    result.push(current.trim())
    return result
  }

  function parseAmount(amt: string) {
    if (!amt) return 0
    let clean = amt.replace(/[₹,",\r]/g, "")
    if (clean.endsWith("-")) clean = "-" + clean.slice(0, -1)
    const val = parseFloat(clean)
    return isNaN(val) ? 0 : val
  }

  function parseDate(dateStr: string) {
    if (!dateStr || dateStr === "0") return null
    const parts = dateStr.replace("\r", "").split("-")
    if (parts.length !== 3) {
        // Try D-M-YYYY with slashes or other separators if needed
        const parts2 = dateStr.replace("\r", "").split("/")
        if (parts2.length === 3) {
            let [d, m, y] = parts2
            return new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d)))
        }
        return null
    }
    let [d, m, y] = parts
    const months: Record<string, number> = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    }
    const month = months[m] !== undefined ? months[m] : (parseInt(m) - 1)
    if (parseInt(y) < 100) y = "20" + y // Handle YY
    return new Date(Date.UTC(parseInt(y), month, parseInt(d)))
  }

  let currentCohort = 0
  let studentCount = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = parseCsvLine(line)
    
    const srNo = cols[0]
    const studentName = cols[1]
    
    // Cohort header check
    if (!srNo && !studentName && cols[3]) {
        currentCohort = parseInt(cols[3]) || currentCohort
        continue
    }

    // Special case for Aditya Singhal and the header line above him
    if (studentName === "Aditya Singhal") currentCohort = 3

    if (srNo && !isNaN(parseInt(srNo)) && studentName && studentName !== "TOTAL") {
        const cohortCol = parseInt(cols[3])
        if (cohortCol) currentCohort = cohortCol
        
        const cohort = currentCohort || 3
        const batchYear = cohort === 1 ? 2023 : (cohort === 2 ? 2024 : 2025)
        
        const registration = parseAmount(cols[4])
        const fullFees = parseAmount(cols[5])
        const scholarship = parseAmount(cols[6])
        const cashDiscount = parseAmount(cols[7])
        const otherDeduction = parseAmount(cols[8])
        const netFee = parseAmount(cols[9])
        const balance = parseAmount(cols[20])
        
        const payerName = cols[2]

        const batch = await prisma.batch.findUnique({ where: { year: batchYear } })
        if (!batch) { console.error(`Batch ${batchYear} not found at line ${i+1}`); continue; }
        
        const program = await prisma.program.findFirst({ where: { batchId: batch.id, name: "Enterprise Leadership" } })
        if (!program) { console.error(`Program not found for batch ${batchYear} at line ${i+1}`); continue; }

        const studentsInBatch = await prisma.student.count({ where: { batchId: batch.id } })
        const rollNo = `LE${batchYear}${(studentsInBatch + 1).toString().padStart(3, "0")}`

        console.log(`Importing student #${studentCount + 1}: ${studentName} (${rollNo}) [Batch ${batchYear}]`)

        const student = await prisma.student.create({
            data: {
                name: studentName,
                rollNo,
                batchId: batch.id,
                programId: program.id,
                status: "ACTIVE",
                financial: {
                    create: {
                        baseFee: fullFees,
                        totalWaiver: scholarship,
                        totalDeduction: cashDiscount + otherDeduction,
                        netFee: netFee,
                        installmentType: cohort === 3 ? "ANNUAL" : "CUSTOM",
                        registrationPaid: registration > 0,
                    }
                }
            }
        })

        studentCount++

        const paymentCols = [
            { d: cols[11], a: cols[12] },
            { d: cols[13], a: cols[14] },
            { d: cols[15], a: cols[16] },
            { d: cols[17], a: cols[18] }
        ]

        const paymentsData = paymentCols
            .filter(p => p.d && p.a && parseAmount(p.a) > 0)
            .map(p => ({ date: parseDate(p.d)!, amount: parseAmount(p.a) }))

        if (cohort === 3) {
            // ANNUAL - Create 3 installments
            const installmentAmount = Math.floor(netFee / 3)
            const installments = []
            
            for (let year = 1; year <= 3; year++) {
                const amount = year === 3 ? (netFee - installmentAmount * 2) : installmentAmount
                const dueDate = new Date(Date.UTC(2025 + year - 1, 6, 1)) // July 1st
                
                const inst = await prisma.installment.create({
                    data: {
                        studentId: student.id,
                        year,
                        label: `Year ${year} Fee`,
                        amount,
                        dueDate,
                        status: "UPCOMING"
                    }
                })
                installments.push(inst)
            }
            
            // Map payments to installments
            let remainingPayments = [...paymentsData]
            for (const inst of installments) {
                let instBalance = Number(inst.amount)
                for (let j = 0; j < remainingPayments.length; j++) {
                    const p = remainingPayments[j]
                    if (p.amount <= 0) continue
                    
                    const applied = Math.min(p.amount, instBalance)
                    await prisma.payment.create({
                        data: {
                            studentId: student.id,
                            installmentId: inst.id,
                            date: p.date,
                            amount: applied,
                            payerName: payerName || null,
                            paymentMode: "OTHER"
                        }
                    })
                    
                    p.amount -= applied
                    instBalance -= applied
                    
                    if (instBalance <= 0) {
                        await prisma.installment.update({
                            where: { id: inst.id },
                            data: { 
                                status: "PAID",
                                paidAmount: inst.amount,
                                paidDate: p.date
                            }
                        })
                        break
                    }
                }
                
                if (instBalance > 0 && instBalance < Number(inst.amount)) {
                    await prisma.installment.update({
                        where: { id: inst.id },
                        data: { 
                            status: "PARTIAL",
                            paidAmount: Number(inst.amount) - instBalance
                        }
                    })
                }

                remainingPayments = remainingPayments.filter(p => p.amount > 0)
            }
        } else {
            // CUSTOM - One installment per payment
            for (let j = 0; j < paymentsData.length; j++) {
                const p = paymentsData[j]
                const installment = await prisma.installment.create({
                    data: {
                        studentId: student.id,
                        year: 1,
                        label: `Payment ${j + 1}`,
                        amount: p.amount,
                        dueDate: p.date,
                        paidAmount: p.amount,
                        paidDate: p.date,
                        status: "PAID",
                        paymentMethod: "OTHER"
                    }
                })

                await prisma.payment.create({
                    data: {
                        studentId: student.id,
                        installmentId: installment.id,
                        date: p.date,
                        amount: p.amount,
                        payerName: payerName || null,
                        paymentMode: "OTHER"
                    }
                })
            }
            
            // Large outstanding balance check
            if (balance > 1000) {
                await prisma.installment.create({
                    data: {
                        studentId: student.id,
                        year: 1,
                        label: "Remaining Fee",
                        amount: balance,
                        dueDate: new Date(Date.UTC(2025, 5, 1)), // June 2025
                        status: "OVERDUE"
                    }
                })
            }
        }
    }
  }

  console.log(`\nImport complete! Created ${studentCount} students.`)
  await prisma.$disconnect()
}

main().catch(console.error)
