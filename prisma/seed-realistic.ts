import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Populating Neon PostgreSQL with realistic Priinteve business test data...");

  // 1. Create Product Categories
  const catCards = await prisma.productCategory.upsert({
    where: { name: "NFC & Digital Cards" },
    update: {},
    create: { name: "NFC & Digital Cards" },
  });

  const catDisplay = await prisma.productCategory.upsert({
    where: { name: "Display Standees & QR" },
    update: {},
    create: { name: "Display Standees & QR" },
  });

  const catPrint = await prisma.productCategory.upsert({
    where: { name: "Print Collaterals" },
    update: {},
    create: { name: "Print Collaterals" },
  });

  const catDesign = await prisma.productCategory.upsert({
    where: { name: "Design & Digital Services" },
    update: {},
    create: { name: "Design & Digital Services" },
  });

  console.log("✓ Categories created.");

  // 2. Create Products
  const prod1 = await prisma.product.create({
    data: {
      name: "NFC Smart Business Card (Metal Edition)",
      type: "PRODUCT",
      categoryId: catCards.id,
      description: "Custom engraved matte black metal NFC card with instant digital profile link.",
      sku: "NFC-METAL-01",
      unit: "Piece",
      sellingPricePaise: 149900, // ₹1,499.00
      costPricePaise: 65000,
      gstRate: 18,
      status: "ACTIVE",
    },
  });

  const prod2 = await prisma.product.create({
    data: {
      name: "Digital Business Card (Lifetime License)",
      type: "SERVICE",
      categoryId: catCards.id,
      description: "Cloud-hosted interactive vCard profile with custom domain link and analytics.",
      sku: "VCARD-LIFE-01",
      unit: "License",
      sellingPricePaise: 99900, // ₹999.00
      costPricePaise: 10000,
      gstRate: 18,
      status: "ACTIVE",
    },
  });

  const prod3 = await prisma.product.create({
    data: {
      name: "Acrylic QR Menu Standee (Custom Printed)",
      type: "PRODUCT",
      categoryId: catDisplay.id,
      description: "Dual-sided A5 size clear acrylic standee with metallic base for restaurant tables.",
      sku: "QR-STND-A5",
      unit: "Piece",
      sellingPricePaise: 79900, // ₹799.00
      costPricePaise: 32000,
      gstRate: 18,
      status: "ACTIVE",
    },
  });

  const prod4 = await prisma.product.create({
    data: {
      name: "NFC Table Sticker for Restaurants",
      type: "PRODUCT",
      categoryId: catDisplay.id,
      description: "Waterproof 3M adhesive NFC + QR code sticker for quick table ordering.",
      sku: "NFC-STKR-3M",
      unit: "Pack of 10",
      sellingPricePaise: 49900, // ₹499.00
      costPricePaise: 18000,
      gstRate: 18,
      status: "ACTIVE",
    },
  });

  const prod5 = await prisma.product.create({
    data: {
      name: "Premium Visiting Cards (1000 Pcs Velvet Touch)",
      type: "PRODUCT",
      categoryId: catPrint.id,
      description: "400 GSM art card with double-sided matte velvet lamination and spot UV logo.",
      sku: "PRINT-VC-400GSM",
      unit: "Box",
      sellingPricePaise: 120000, // ₹1,200.00
      costPricePaise: 55000,
      gstRate: 18,
      status: "ACTIVE",
    },
  });

  const prod6 = await prisma.product.create({
    data: {
      name: "Custom Branding & Logo Design Package",
      type: "SERVICE",
      categoryId: catDesign.id,
      description: "Complete corporate identity design including logo, brand guidelines, and card templates.",
      sku: "DSGN-BRAND-PK",
      unit: "Project",
      sellingPricePaise: 500000, // ₹5,000.00
      costPricePaise: 150000,
      gstRate: 18,
      status: "ACTIVE",
    },
  });

  console.log("✓ 6 Realistic Products created.");

  // 3. Create Customers
  const cust1 = await prisma.customer.create({
    data: {
      type: "BUSINESS",
      name: "Apex Gourmet Hospitality Group",
      contactPerson: "Rajesh Malhotra",
      phone: "+91 98250 11223",
      whatsapp: "+91 98250 11223",
      email: "rajesh@apexgourmet.in",
      gstin: "24AAACA1234B1Z9",
      pan: "AAACA1234B",
      billingAddress: "401 Zenith Towers, SG Highway",
      city: "Ahmedabad",
      state: "Gujarat",
      pincode: "380054",
      notes: "VIP Client. Chain of 5 luxury dining restaurants across Gujarat.",
      status: "ACTIVE",
    },
  });

  const cust2 = await prisma.customer.create({
    data: {
      type: "BUSINESS",
      name: "Studio Design & Print Works",
      contactPerson: "Priya Sharma",
      phone: "+91 97123 44556",
      whatsapp: "+91 97123 44556",
      email: "priya@studiodesign.com",
      gstin: "24BBBCA5678C1Z3",
      city: "Surat",
      state: "Gujarat",
      pincode: "395007",
      status: "ACTIVE",
    },
  });

  const cust3 = await prisma.customer.create({
    data: {
      type: "INDIVIDUAL",
      name: "Vikramaditya Sharma",
      contactPerson: "Self",
      phone: "+91 99090 88776",
      whatsapp: "+91 99090 88776",
      email: "vikram@innovate.co",
      city: "Vadodara",
      state: "Gujarat",
      pincode: "390001",
      status: "ACTIVE",
    },
  });

  const cust4 = await prisma.customer.create({
    data: {
      type: "BUSINESS",
      name: "Dr. Ananya Roy - Multispecialty Healthcare Clinics & Research Center",
      contactPerson: "Dr. Ananya Roy",
      phone: "+91 94260 99887",
      email: "ananya.roy@healthclinic.org",
      billingAddress: "Plot 88, Science City Road, Opposite Capital Complex",
      city: "Gandhinagar",
      state: "Gujarat",
      pincode: "382010",
      status: "ACTIVE",
    },
  });

  console.log("✓ 4 Realistic Customers created.");

  // 4. Create Vendors
  const vendor1 = await prisma.vendor.create({
    data: {
      businessName: "Gujarat Paper & Board Mills Ltd",
      contactPerson: "Suresh Patel",
      phone: "+91 98980 12345",
      email: "orders@gujaratpaper.com",
      gstin: "24AAACG9999F1ZX",
      city: "Ahmedabad",
      state: "Gujarat",
      status: "ACTIVE",
    },
  });

  const vendor2 = await prisma.vendor.create({
    data: {
      businessName: "Sun Inks & Chemical Solutions",
      contactPerson: "Amit Shah",
      phone: "+91 98799 54321",
      email: "sales@suninks.co.in",
      city: "Vadodara",
      state: "Gujarat",
      status: "ACTIVE",
    },
  });

  console.log("✓ 2 Vendors created.");

  // 5. Create Expenses
  const expCat1 = await prisma.expenseCategory.findFirst({ where: { name: "Paper & Raw Materials" } });
  const expCat2 = await prisma.expenseCategory.findFirst({ where: { name: "Ink & Chemicals" } });

  if (expCat1) {
    await prisma.expense.create({
      data: {
        number: "EXP-2026-0001",
        date: new Date(),
        vendorId: vendor1.id,
        categoryId: expCat1.id,
        description: "Purchase of 50 Rims 400 GSM Art Board Paper",
        baseAmountPaise: 2500000, // ₹25,000.00
        gstRate: 18,
        gstAmountPaise: 450000,
        totalAmountPaise: 2950000, // ₹29,500.00
        paymentMethod: "BANK_TRANSFER",
        status: "RECORDED",
      },
    });
  }

  if (expCat2) {
    await prisma.expense.create({
      data: {
        number: "EXP-2026-0002",
        date: new Date(),
        vendorId: vendor2.id,
        categoryId: expCat2.id,
        description: "UV Gloss Coating Inks & Cleaner Chemicals",
        baseAmountPaise: 800000, // ₹8,000.00
        gstRate: 18,
        gstAmountPaise: 144000,
        totalAmountPaise: 944000, // ₹9,440.00
        paymentMethod: "UPI",
        status: "RECORDED",
      },
    });
  }

  console.log("✓ Expenses created.");

  console.log("🎉 Realistic seeding completed successfully.");
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

