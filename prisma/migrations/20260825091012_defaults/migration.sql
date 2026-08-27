-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CompanySettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'Priinteve',
    "logoUrl" TEXT,
    "tagline" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankIfsc" TEXT,
    "bankBranch" TEXT,
    "quotationTerms" TEXT,
    "invoiceTerms" TEXT,
    "defaultGstRate" REAL NOT NULL DEFAULT 18,
    "defaultValidityDays" INTEGER NOT NULL DEFAULT 15,
    "defaultDueDays" INTEGER NOT NULL DEFAULT 15,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CompanySettings" ("addressLine1", "addressLine2", "bankAccountName", "bankAccountNumber", "bankBranch", "bankIfsc", "bankName", "city", "defaultGstRate", "email", "gstin", "id", "invoiceTerms", "logoUrl", "name", "pan", "phone", "pincode", "quotationTerms", "state", "tagline", "updatedAt", "website") SELECT "addressLine1", "addressLine2", "bankAccountName", "bankAccountNumber", "bankBranch", "bankIfsc", "bankName", "city", "defaultGstRate", "email", "gstin", "id", "invoiceTerms", "logoUrl", "name", "pan", "phone", "pincode", "quotationTerms", "state", "tagline", "updatedAt", "website" FROM "CompanySettings";
DROP TABLE "CompanySettings";
ALTER TABLE "new_CompanySettings" RENAME TO "CompanySettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
