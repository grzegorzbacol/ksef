-- CreateTable
CREATE TABLE "DeletedMailInvoiceMessageId" (
    "id" TEXT NOT NULL,
    "emailMessageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletedMailInvoiceMessageId_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeletedMailInvoiceMessageId_emailMessageId_key" ON "DeletedMailInvoiceMessageId"("emailMessageId");
