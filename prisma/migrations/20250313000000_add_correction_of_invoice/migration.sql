-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "correctionOfId" TEXT;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
