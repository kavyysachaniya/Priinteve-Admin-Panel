import { prisma } from "../lib/prisma";
import * as customerService from "../lib/services/customers";
import * as productService from "../lib/services/products";
import * as quotationService from "../lib/services/quotations";
import * as paymentService from "../lib/services/payments";
import * as invoiceService from "../lib/services/invoices";
import * as expenseService from "../lib/services/expenses";
import * as vendorService from "../lib/services/vendors";
import { getProfitAndLoss, getBalanceSheet, getCashFlow, getGSTReport } from "../lib/services/accounting/reports";
import { listAccounts } from "../lib/services/accounting/accounts";
import { listJournalEntries } from "../lib/services/accounting/journal";
import { seedChartOfAccounts } from "../lib/services/accounting/accounts";
import { formatCurrency } from "../lib/money";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function main() {
  console.log("=== PHASE 4: ACCOUNTING SYSTEM VERIFICATION SCENARIO ===");

  console.log("0. Syncing numbering sequences to prevent unique constraint violations...");
  const year = new Date().getFullYear();
  
  // Sync Expense
  const expenses = await prisma.expense.findMany({ select: { number: true } });
  let maxExpense = 0;
  for (const exp of expenses) {
    const parts = exp.number.split("-");
    const num = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(num) && num > maxExpense) maxExpense = num;
  }
  await prisma.numberingSequence.upsert({
    where: { key: "expense" },
    update: { nextNumber: Math.max(maxExpense + 1, 2) },
    create: { key: "expense", prefix: "EXP", year, nextNumber: Math.max(maxExpense + 1, 2) },
  });

  // Sync Invoice
  const invoices = await prisma.invoice.findMany({ select: { number: true } });
  let maxInvoice = 0;
  for (const inv of invoices) {
    const parts = inv.number.split("-");
    const num = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(num) && num > maxInvoice) maxInvoice = num;
  }
  await prisma.numberingSequence.upsert({
    where: { key: "invoice" },
    update: { nextNumber: Math.max(maxInvoice + 1, 2) },
    create: { key: "invoice", prefix: "INV", year, nextNumber: Math.max(maxInvoice + 1, 2) },
  });

  // Sync Journal
  const journals = await prisma.journalEntry.findMany({ select: { number: true } });
  let maxJournal = 0;
  for (const je of journals) {
    const parts = je.number.split("-");
    const num = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(num) && num > maxJournal) maxJournal = num;
  }
  await prisma.numberingSequence.upsert({
    where: { key: "journal" },
    update: { nextNumber: Math.max(maxJournal + 1, 2) },
    create: { key: "journal", prefix: "JE", year, nextNumber: Math.max(maxJournal + 1, 2) },
  });
  console.log("   OK: Sequences synchronized.");

  console.log("1. Seeding Chart of Accounts...");
  await seedChartOfAccounts();
  const accounts = await listAccounts();
  assert(accounts.length > 0, "Accounts list should not be empty after seeding");
  console.log(`   OK: Seeded ${accounts.length} accounts.`);

  const yearRange = { startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") };
  const initialPL = await getProfitAndLoss(yearRange);
  const initialCF = await getCashFlow(yearRange);
  const initialGST = await getGSTReport(yearRange);

  console.log("2. Creating customer (ABC Restaurant)...");
  const customer = await customerService.createCustomer({
    type: "BUSINESS",
    name: "ABC Restaurant",
    contactPerson: "Rahul",
    phone: "9123456789",
    whatsapp: "",
    email: "rahul@abcrestaurant.com",
    gstin: "27AAAAA1111A1Z1", // Maharashtra
    pan: "AAAAA1111A",
    billingAddress: "456 Andheri Link Road",
    shippingAddress: "",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400053",
    notes: "",
    tags: "",
    status: "ACTIVE",
  });
  console.log(`   OK: Created Customer ID ${customer.id}`);

  console.log("3. Creating Products...");
  // QR Menu Cards @ ₹500
  const prodMenu = await productService.createProduct({
    name: "QR Menu Card",
    type: "PRODUCT",
    categoryName: "Print Collaterals",
    description: "Custom laminated table menus",
    sku: "QR-MENU",
    unit: "Piece",
    sellingPrice: 500,
    gstRate: 18,
    status: "ACTIVE",
  });
  // QR Standee @ ₹1500
  const prodStandee = await productService.createProduct({
    name: "QR Standee",
    type: "PRODUCT",
    categoryName: "Display Standees & QR",
    description: "A5 Acrylic standee",
    sku: "QR-STAND",
    unit: "Piece",
    sellingPrice: 1500,
    gstRate: 18,
    status: "ACTIVE",
  });
  // NFC Cards @ ₹999
  const prodNfc = await productService.createProduct({
    name: "NFC Card",
    type: "PRODUCT",
    categoryName: "NFC & Digital Cards",
    description: "Metal NFC card",
    sku: "NFC-METAL",
    unit: "Piece",
    sellingPrice: 999,
    gstRate: 18,
    status: "ACTIVE",
  });
  console.log("   OK: Created 3 Products.");

  console.log("4. Simulating Sales Flow: Quotation → Accepted → Converted to Invoice...");
  const quotation = await quotationService.createQuotation({
    customerId: customer.id,
    issueDate: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
    notes: "",
    terms: "",
    shippingCharge: 0,
    items: [
      { productId: prodMenu.id, name: prodMenu.name, quantity: 10, rate: 500, discountPercent: 0, gstRate: 18 },
      { productId: prodStandee.id, name: prodStandee.name, quantity: 2, rate: 1500, discountPercent: 0, gstRate: 18 },
      { productId: prodNfc.id, name: prodNfc.name, quantity: 1, rate: 999, discountPercent: 0, gstRate: 18 },
    ],
  });
  assert(quotation.subtotalPaise === 899900, "Subtotal must be 899,900 paise");
  assert(quotation.taxPaise === 161982, `Tax must be 161,982 paise, got ${quotation.taxPaise}`);
  assert(quotation.totalPaise === 1061882, `Total must be 1,061,882 paise, got ${quotation.totalPaise}`);
  console.log("   OK: Quotation calculated correctly.");

  await quotationService.changeQuotationStatus(quotation.id, "SENT");
  await quotationService.changeQuotationStatus(quotation.id, "ACCEPTED");

  const invoice = await quotationService.convertQuotationToInvoice(quotation.id);
  assert(invoice.totalPaise === quotation.totalPaise, "Invoice total must equal quotation total");
  console.log(`   OK: Converted to Invoice ${invoice.number} (Status: ${invoice.status})`);

  console.log("5. Activating Invoice (Mark Sent) to Trigger Auto-Accounting...");
  const sentInvoice = await invoiceService.markInvoiceSent(invoice.id);
  
  // Verify Journal Entry for Invoice
  const { entries } = await listJournalEntries({ q: sentInvoice.number });
  assert(entries.length === 1, "There should be exactly one journal entry matching this invoice");
  const je = entries[0];
  assert(je.status === "POSTED", "Journal entry must be posted");
  assert(je.totalDebit === sentInvoice.totalPaise, `Debit total should equal invoice total, got ${je.totalDebit}`);
  assert(je.totalDebit === je.totalCredit, "Total debits must equal total credits in invoice JE");
  console.log(`   OK: Invoice Journal posted & balanced (Total: ${je.totalDebit} paise)`);

  console.log("6. Simulating Customer Payment in two installments...");
  // Installment 1: ₹5,000 (Partial)
  const p1 = await paymentService.createPayment({
    customerId: customer.id,
    invoiceId: sentInvoice.id,
    paymentDate: new Date().toISOString().slice(0, 10),
    amount: 5000,
    method: "BANK_TRANSFER",
    referenceNumber: "TXN111",
    notes: "First installment",
    paymentAccountId: "", // auto-resolves to HDFC Bank (code 1020)
  });
  
  // Installment 2: Remaining outstanding (₹5,618.82)
  const outstandingPaise = sentInvoice.totalPaise - 500000;
  const p2 = await paymentService.createPayment({
    customerId: customer.id,
    invoiceId: sentInvoice.id,
    paymentDate: new Date().toISOString().slice(0, 10),
    amount: outstandingPaise / 100,
    method: "UPI",
    referenceNumber: "TXN222",
    notes: "Second installment",
    paymentAccountId: "",
  });

  const updatedInvoice = await invoiceService.getInvoiceDetail(sentInvoice.id);
  assert(updatedInvoice!.status === "PAID", "Invoice status must be PAID");
  assert(updatedInvoice!.amountPaidPaise === sentInvoice.totalPaise, "Invoice should be fully paid");

  // Verify journal entries for payments
  const jePayment1 = await prisma.journalEntry.findFirst({
    where: { paymentId: p1.id },
    include: { lines: true }
  });
  const jePayment2 = await prisma.journalEntry.findFirst({
    where: { paymentId: p2.id },
    include: { lines: true }
  });

  assert(jePayment1 !== null, "Payment 1 must have a journal entry");
  assert(jePayment2 !== null, "Payment 2 must have a journal entry");
  assert(jePayment1.status === "POSTED" && jePayment2.status === "POSTED", "Payment journals must be posted");

  const sumDebits1 = jePayment1.lines.reduce((s, l) => s + l.debitPaise, 0);
  const sumCredits1 = jePayment1.lines.reduce((s, l) => s + l.creditPaise, 0);
  assert(sumDebits1 === sumCredits1 && sumDebits1 === p1.amountPaise, "Payment 1 journal must be balanced");

  const sumDebits2 = jePayment2.lines.reduce((s, l) => s + l.debitPaise, 0);
  const sumCredits2 = jePayment2.lines.reduce((s, l) => s + l.creditPaise, 0);
  assert(sumDebits2 === sumCredits2 && sumDebits2 === p2.amountPaise, "Payment 2 journal must be balanced");

  console.log("   OK: Payments journalized and balanced. Invoice status: PAID.");

  console.log("7. Simulating Expense Flow: Vendor Bills & operational payments...");
  const vendor = await vendorService.createVendor({
    businessName: "XYZ Printing Supplies",
    contactPerson: "Mr. Shah",
    phone: "9988776655",
    email: "sales@xyzprint.com",
    gstin: "24AAAAA2222A2Z2", // Gujarat
    address: "101 GIDC Vatva",
    city: "Ahmedabad",
    state: "Gujarat",
    pincode: "382440",
    notes: "",
    status: "ACTIVE",
  });

  const expenseCategory = await prisma.expenseCategory.findFirst({
    where: { name: "Paper & Raw Materials" },
  });
  assert(expenseCategory !== null, "Expense category must exist");

  const expense = await expenseService.createExpense({
    description: "Purchase of art card paper sheets",
    categoryId: expenseCategory!.id,
    vendorId: vendor.id,
    date: new Date().toISOString().slice(0, 10),
    baseAmountPaise: 1000000, // ₹10,000 base
    gstRate: 18,
    gstAmountPaise: 180000,   // ₹1,800 GST
    totalAmountPaise: 1180000, // ₹11,800 total
    paymentMethod: "BANK_TRANSFER",
    referenceNumber: "EXP999",
    status: "RECORDED",
    notes: "",
  });

  // Verify expense journal
  const { entries: jeExpenses } = await listJournalEntries({ q: expense.number });
  assert(jeExpenses.length === 1, "There should be exactly one journal entry matching this expense");
  const expJE = jeExpenses[0];
  assert(expJE.status === "POSTED", "Expense journal entry must be posted");
  assert(expJE.totalDebit === expJE.totalCredit, "Expense journal entry must be balanced");
  assert(expJE.totalDebit === expense.totalAmountPaise, "Total debits must match expense total");
  console.log(`   OK: Expense Journal posted & balanced (Total: ${expJE.totalDebit} paise)`);

  console.log("8. Verifying Financial Reports Invariants & Internal Consistency...");
  
  const pl = await getProfitAndLoss(yearRange);
  console.log(`   P&L Revenue: ${formatCurrency(pl.totalIncomePaise)}`);
  console.log(`   P&L Expenses: ${formatCurrency(pl.totalExpensesPaise)}`);
  console.log(`   P&L Net Profit: ${formatCurrency(pl.netProfitPaise)}`);
  
  const diffRevenue = pl.totalIncomePaise - initialPL.totalIncomePaise;
  const diffExpenses = pl.totalExpensesPaise - initialPL.totalExpensesPaise;
  const diffProfit = pl.netProfitPaise - initialPL.netProfitPaise;

  assert(diffRevenue === 899900, `Expected Income change of 899,900, got ${diffRevenue}`);
  assert(diffExpenses === 1000000, `Expected Expense change of 1,000,000, got ${diffExpenses}`);
  assert(diffProfit === -100100, `Expected Net Profit change of -100,100, got ${diffProfit}`);

  const bs = await getBalanceSheet(new Date("2026-12-31"));
  console.log(`   Balance Sheet Assets: ${formatCurrency(bs.totalAssets)}`);
  console.log(`   Balance Sheet Liabilities: ${formatCurrency(bs.totalLiabilities)}`);
  console.log(`   Balance Sheet Equity (incl. P&L): ${formatCurrency(bs.totalEquity)}`);
  console.log(`   Balance Sheet Balanced?: ${bs.isBalanced ? "YES" : "NO"}`);
  
  assert(bs.isBalanced === true, `Balance sheet must balance! Imbalance: ${bs.imbalancePaise}`);

  const cf = await getCashFlow(yearRange);
  console.log(`   Cash Flow Opening: ${formatCurrency(cf.openingCashPaise)}`);
  console.log(`   Cash Flow Inflows: ${formatCurrency(cf.operatingInflowPaise)}`);
  console.log(`   Cash Flow Outflows: ${formatCurrency(cf.operatingOutflowPaise)}`);
  console.log(`   Cash Flow Closing: ${formatCurrency(cf.closingCashPaise)}`);
  
  const diffInflow = cf.operatingInflowPaise - initialCF.operatingInflowPaise;
  const diffOutflow = cf.operatingOutflowPaise - initialCF.operatingOutflowPaise;

  assert(diffInflow === 1061882, `Expected Inflow change of 1,061,882, got ${diffInflow}`);
  assert(diffOutflow === 1180000, `Expected Outflow change of 1,180,000, got ${diffOutflow}`);
  assert(cf.closingCashPaise === cf.openingCashPaise - 118118, "Closing cash must match expected transaction flows");

  const gst = await getGSTReport(yearRange);
  console.log(`   GST Output: ${formatCurrency(gst.outputGstPaise)}`);
  console.log(`   GST Input: ${formatCurrency(gst.inputGstPaise)}`);
  console.log(`   GST Net Position: ${formatCurrency(gst.netGstPayablePaise)}`);
  
  const diffGstOutput = gst.outputGstPaise - initialGST.outputGstPaise;
  const diffGstInput = gst.inputGstPaise - initialGST.inputGstPaise;
  const diffGstNet = gst.netGstPayablePaise - initialGST.netGstPayablePaise;

  assert(diffGstOutput === 161982, `Expected Output GST change of 161,982, got ${diffGstOutput}`);
  assert(diffGstInput === 180000, `Expected Input GST change of 180,000, got ${diffGstInput}`);
  assert(diffGstNet === -18018, `Expected Net GST change of -18,018, got ${diffGstNet}`);

  console.log("\n✅ ALL DOUBLE-ENTRY INVARIANTS AND REPORT BALANCES FULLY AGREE AND PASS!");
}

main()
  .catch((err) => {
    console.error("\n❌ ACCOUNTING TEST FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
