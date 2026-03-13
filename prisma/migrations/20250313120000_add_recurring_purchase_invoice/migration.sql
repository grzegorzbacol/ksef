-- CreateTable
CREATE TABLE "RecurringPurchaseInvoice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dayOfMonth" INTEGER NOT NULL,
    "sellerName" TEXT NOT NULL,
    "sellerNip" TEXT NOT NULL,
    "expenseCategoryId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringPurchaseInvoice_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "recurringPurchaseInvoiceId" TEXT;

-- AddForeignKey
ALTER TABLE "RecurringPurchaseInvoice" ADD CONSTRAINT "RecurringPurchaseInvoice_expenseCategoryId_fkey" FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_recurringPurchaseInvoiceId_fkey" FOREIGN KEY ("recurringPurchaseInvoiceId") REFERENCES "RecurringPurchaseInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
