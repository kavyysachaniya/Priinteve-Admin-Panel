import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

const DEFAULT_EXPENSE_CATEGORIES = [
  "Paper & Raw Materials",
  "Ink & Chemicals",
  "Equipment Maintenance",
  "Logistics & Transport",
  "Utilities & Rent",
  "Staff & Payroll",
  "Software & Tools",
  "Marketing & Office",
];

const DEFAULT_SETTINGS = {
  id: "default",
  name: "Priinteve",
  tagline: "Print. Design. Digital.",
  addressLine1: "123 Industrial Area, Phase II",
  addressLine2: "",
  city: "Ahmedabad",
  state: "Gujarat",
  pincode: "380001",
  phone: "+91 98765 43210",
  email: "contact@priinteve.com",
  website: "https://priinteve.com",
  gstin: "24AAAAA0000A1Z5",
  pan: "AAAAA0000A",
  bankName: "HDFC Bank",
  bankAccountName: "Priinteve Enterprises",
  bankAccountNumber: "50200012345678",
  bankIfsc: "HDFC0001234",
  bankBranch: "Main Branch, Ahmedabad",
  quotationTerms:
    "1. Prices are valid until the date mentioned above.\n2. 50% advance payment required to begin work.\n3. Delivery timelines begin after design/content approval.",
  invoiceTerms:
    "1. Payment due within the stated due date.\n2. Please share the payment reference after transfer.\n3. Goods once sold / services rendered are not refundable.",
  defaultGstRate: 18,
  defaultValidityDays: 15,
  defaultDueDays: 15,
};

const DEFAULT_NUMBERING_SEQUENCES = [
  { key: "quotation", prefix: "QTN", year: 2026, nextNumber: 1, padding: 4 },
  { key: "invoice", prefix: "INV", year: 2026, nextNumber: 1, padding: 4 },
  { key: "order", prefix: "ORD", year: 2026, nextNumber: 1, padding: 4 },
  { key: "production", prefix: "PROD", year: 2026, nextNumber: 1, padding: 4 },
  { key: "delivery", prefix: "DEL", year: 2026, nextNumber: 1, padding: 4 },
  { key: "expense", prefix: "EXP", year: 2026, nextNumber: 1, padding: 4 },
];

async function main() {
  console.log("🌱 Starting Neon PostgreSQL database seeding...");

  // 1. Seed Expense Categories
  for (const catName of DEFAULT_EXPENSE_CATEGORIES) {
    await prisma.expenseCategory.upsert({
      where: { name: catName },
      update: {},
      create: { name: catName, isSystem: true },
    });
  }
  console.log("✓ Expense categories initialized.");

  // 2. Seed Company Settings
  const settingsCount = await prisma.companySettings.count();
  if (settingsCount === 0) {
    await prisma.companySettings.create({ data: DEFAULT_SETTINGS });
    console.log("✓ Default company settings initialized.");
  }

  // 3. Seed Numbering Sequences
  for (const seq of DEFAULT_NUMBERING_SEQUENCES) {
    await prisma.numberingSequence.upsert({
      where: { key: seq.key },
      update: {},
      create: seq,
    });
  }
  console.log("✓ Numbering sequences initialized.");

  // 4. Seed initial users (only if no users exist)
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const bcrypt = await import("bcryptjs");
    const SALT_ROUNDS = 12;

    const adminHash = await bcrypt.hash("Priinteve@2026", SALT_ROUNDS);
    const emp1Hash = await bcrypt.hash("Employee@2026", SALT_ROUNDS);
    const emp2Hash = await bcrypt.hash("Employee@2026", SALT_ROUNDS);

    await prisma.user.create({
      data: {
        name: "Admin",
        email: "admin@priinteve.com",
        passwordHash: adminHash,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });

    await prisma.user.create({
      data: {
        name: "Employee One",
        email: "employee1@priinteve.com",
        passwordHash: emp1Hash,
        role: "EMPLOYEE",
        status: "ACTIVE",
      },
    });

    await prisma.user.create({
      data: {
        name: "Employee Two",
        email: "employee2@priinteve.com",
        passwordHash: emp2Hash,
        role: "EMPLOYEE",
        status: "ACTIVE",
      },
    });

    console.log("✓ Initial users seeded:");
    console.log("  ADMIN    → admin@priinteve.com       / Priinteve@2026");
    console.log("  EMPLOYEE → employee1@priinteve.com   / Employee@2026");
    console.log("  EMPLOYEE → employee2@priinteve.com   / Employee@2026");
    console.log("  ⚠ Change these passwords after first login!");
  } else {
    console.log("✓ Users already exist — skipping user seed.");
  }

  // 4. Restore backed up SQLite data if backup file exists
  const backupPath = path.join(
    process.cwd(),
    "C:/Users/Admin/.gemini/antigravity/brain/87fbde03-bc4e-40aa-b68e-963646fbd4f6/scratch/sqlite-data-export.json"
  );

  if (fs.existsSync(backupPath)) {
    try {
      const raw = fs.readFileSync(backupPath, "utf8");
      const backup = JSON.parse(raw);

      // Restore Customers
      if (backup.customers?.length) {
        for (const c of backup.customers) {
          const { id, createdAt, updatedAt, ...cData } = c;
          await prisma.customer.upsert({
            where: { id },
            update: cData,
            create: { id, ...cData },
          });
        }
        console.log(`✓ Restored ${backup.customers.length} customer records.`);
      }

      // Restore Products
      if (backup.products?.length) {
        for (const p of backup.products) {
          const { id, createdAt, updatedAt, ...pData } = p;
          await prisma.product.upsert({
            where: { id },
            update: pData,
            create: { id, ...pData },
          });
        }
        console.log(`✓ Restored ${backup.products.length} product records.`);
      }

      // Restore Quotations
      if (backup.quotations?.length) {
        for (const q of backup.quotations) {
          const { id, createdAt, updatedAt, items, ...qData } = q;
          await prisma.quotation.upsert({
            where: { id },
            update: qData,
            create: {
              id,
              ...qData,
              items: items?.length
                ? {
                    create: items.map((item: any) => {
                      const { id: itemId, quotationId, ...itemData } = item;
                      return { id: itemId, ...itemData };
                    }),
                  }
                : undefined,
            },
          });
        }
        console.log(`✓ Restored ${backup.quotations.length} quotation records.`);
      }

      // Restore Invoices
      if (backup.invoices?.length) {
        for (const inv of backup.invoices) {
          const { id, createdAt, updatedAt, items, ...invData } = inv;
          await prisma.invoice.upsert({
            where: { id },
            update: invData,
            create: {
              id,
              ...invData,
              items: items?.length
                ? {
                    create: items.map((item: any) => {
                      const { id: itemId, invoiceId, ...itemData } = item;
                      return { id: itemId, ...itemData };
                    }),
                  }
                : undefined,
            },
          });
        }
        console.log(`✓ Restored ${backup.invoices.length} invoice records.`);
      }
    } catch (err) {
      console.warn("Notice: Could not parse backup seed file:", err);
    }
  }

  console.log("🎉 Database seeding completed successfully.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Seeding error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });

