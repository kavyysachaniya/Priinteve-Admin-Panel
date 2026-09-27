// Verification script for the core business flow (spec §19).
// Exercises the real service layer against the configured database — the same
// functions the UI calls — end to end: Customer → Product → Quotation →
// Accept → Convert to Invoice → Partial Payment → Full Payment → Dashboard.
// It removes everything it creates (and leftovers from earlier runs) so the
// test customer's revenue never lingers in real dashboards/reports.
import { prisma } from "../lib/prisma";
import * as customerService from "../lib/services/customers";
import * as productService from "../lib/services/products";
import * as quotationService from "../lib/services/quotations";
import * as paymentService from "../lib/services/payments";
import { getInvoiceDetail } from "../lib/services/invoices";
import { getSummaryCards } from "../lib/services/dashboard";
import { getFinanceOverview } from "../lib/services/finance";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
}

const TEST_CUSTOMER_NAME = "Test Flow Customer";
const TEST_CUSTOMER_EMAIL = "testflow@example.com";
const TEST_PRODUCT_NAME = "Digital Business Card";

/** Deletes every record this script creates, for all test customers (current and previous runs). */
async function cleanupTestFlowData() {
  const customers = await prisma.customer.findMany({
    where: { name: TEST_CUSTOMER_NAME, email: TEST_CUSTOMER_EMAIL },
    select: {
      id: true,
      quotations: { select: { id: true, items: { select: { productId: true } } } },
      invoices: { select: { id: true } },
      payments: { select: { id: true } },
      orders: { select: { id: true } },
    },
  });
  if (customers.length === 0) return 0;

  const customerIds = customers.map((c) => c.id);
  const quotationIds = customers.flatMap((c) => c.quotations.map((q) => q.id));
  const invoiceIds = customers.flatMap((c) => c.invoices.map((i) => i.id));
  const paymentIds = customers.flatMap((c) => c.payments.map((p) => p.id));
  const productIds = [
    ...new Set(customers.flatMap((c) => c.quotations.flatMap((q) => q.items.map((i) => i.productId)))),
  ].filter((id): id is string => Boolean(id));

  // Never rewrite history the user has formally closed.
  const journals = await prisma.journalEntry.findMany({
    where: { OR: [{ invoiceId: { in: invoiceIds } }, { paymentId: { in: paymentIds } }] },
    select: { id: true, date: true },
  });
  const closed = await prisma.accountingPeriod.findMany({ where: { status: "CLOSED" }, select: { startDate: true, endDate: true } });
  const inClosed = journals.filter((j) => closed.some((p) => j.date >= p.startDate && j.date <= p.endDate));
  if (inClosed.length) throw new Error(`Refusing cleanup: ${inClosed.length} test journal entries fall in a closed accounting period.`);

  if (customers.some((c) => c.orders.length)) throw new Error("Refusing cleanup: a test customer has orders, which this script never creates.");

  await prisma.$transaction([
    prisma.activityLog.deleteMany({
      where: {
        OR: [
          { customerId: { in: customerIds } },
          { quotationId: { in: quotationIds } },
          { invoiceId: { in: invoiceIds } },
          { paymentId: { in: paymentIds } },
          { entityId: { in: [...customerIds, ...quotationIds, ...invoiceIds, ...paymentIds, ...productIds] } },
        ],
      },
    }),
    prisma.journalEntry.deleteMany({ where: { id: { in: journals.map((j) => j.id) } } }),
    prisma.payment.deleteMany({ where: { id: { in: paymentIds } } }),
    prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } }),
    prisma.quotation.deleteMany({ where: { id: { in: quotationIds } } }),
    prisma.product.deleteMany({
      where: {
        id: { in: productIds },
        name: TEST_PRODUCT_NAME,
        quotationItems: { none: {} },
        invoiceItems: { none: {} },
        orderItems: { none: {} },
      },
    }),
    prisma.customer.deleteMany({ where: { id: { in: customerIds } } }),
  ]);
  return customers.length;
}

async function main() {
  const leftovers = await cleanupTestFlowData();
  if (leftovers) console.log(`0) Removed ${leftovers} leftover test customer(s) from earlier runs.`);

  console.log("1) Creating customer…");
  const customer = await customerService.createCustomer({
    type: "INDIVIDUAL",
    name: TEST_CUSTOMER_NAME,
    contactPerson: "",
    phone: "9876543210",
    whatsapp: "",
    email: TEST_CUSTOMER_EMAIL,
    gstin: "",
    pan: "",
    billingAddress: "123 MG Road",
    shippingAddress: "",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411001",
    notes: "",
    tags: "",
    status: "ACTIVE",
  });
  console.log("   OK:", customer.id, customer.name);

  console.log("2) Creating product: Digital Business Card @ ₹999…");
  const product = await productService.createProduct({
    name: TEST_PRODUCT_NAME,
    type: "SERVICE",
    categoryName: "Digital Products",
    description: "A shareable digital business card",
    sku: "",
    unit: "Unit",
    sellingPrice: 999,
    costPrice: undefined,
    gstRate: 18,
    status: "ACTIVE",
  });
  assert(product.sellingPricePaise === 99900, "product price should be stored as 99900 paise");
  console.log("   OK:", product.id, product.name, product.sellingPricePaise, "paise");

  console.log("3) Creating quotation for customer with the product…");
  const quotation = await quotationService.createQuotation({
    customerId: customer.id,
    issueDate: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
    notes: "",
    terms: "",
    shippingCharge: 0,
    items: [
      {
        productId: product.id,
        name: product.name,
        description: product.description ?? "",
        quantity: 2,
        rate: 999,
        discountPercent: 0,
        gstRate: 18,
      },
    ],
  });
  // 2 * 999 = 1998 subtotal, 18% gst = 359.64 -> rounds to 35964 paise, total = 199800+35964=235764
  assert(quotation.subtotalPaise === 199800, `subtotal should be 199800, got ${quotation.subtotalPaise}`);
  assert(quotation.taxPaise === 35964, `tax should be 35964, got ${quotation.taxPaise}`);
  assert(quotation.totalPaise === 235764, `total should be 235764, got ${quotation.totalPaise}`);
  assert(quotation.status === "DRAFT", "new quotation should be DRAFT");
  console.log("   OK:", quotation.number, "total:", quotation.totalPaise, "paise — Draft");

  console.log("4) Marking quotation Sent, then Accepted…");
  await quotationService.changeQuotationStatus(quotation.id, "SENT");
  const accepted = await quotationService.changeQuotationStatus(quotation.id, "ACCEPTED");
  assert(accepted.status === "ACCEPTED", "quotation should be ACCEPTED");
  console.log("   OK: status =", accepted.status);

  console.log("5) Converting quotation to invoice…");
  const invoice = await quotationService.convertQuotationToInvoice(quotation.id);
  assert(invoice.customerId === customer.id, "invoice customer should match quotation customer");
  assert(invoice.totalPaise === quotation.totalPaise, "invoice total should match quotation total");
  assert(invoice.sourceQuotationId === quotation.id, "invoice should link back to source quotation");
  console.log("   OK:", invoice.number, "total:", invoice.totalPaise, "paise, source:", invoice.sourceQuotationId);

  console.log("6) Verifying converted quotation & invoice item data…");
  const invoiceDetail = await getInvoiceDetail(invoice.id);
  assert(invoiceDetail !== null, "invoice detail should exist");
  assert(invoiceDetail!.items.length === 1, "invoice should have 1 item");
  assert(invoiceDetail!.items[0].quantity === 2, "invoice item quantity should be 2");
  assert(invoiceDetail!.items[0].ratePaise === 99900, "invoice item rate should be 99900 paise");
  const requotedQuotation = await quotationService.getQuotationDetail(quotation.id);
  assert(requotedQuotation!.status === "CONVERTED", "source quotation should now be CONVERTED");
  console.log("   OK: items and customer transferred correctly; quotation is CONVERTED");

  console.log("7) Recording partial payment (₹1000)…");
  const partialAmount = 1000;
  await paymentService.createPayment({
    customerId: customer.id,
    invoiceId: invoice.id,
    paymentDate: new Date().toISOString().slice(0, 10),
    amount: partialAmount,
    method: "UPI",
    referenceNumber: "TESTUTR1",
    notes: "",
  });
  const afterPartial = await getInvoiceDetail(invoice.id);
  assert(afterPartial!.status === "PARTIALLY_PAID", `expected PARTIALLY_PAID, got ${afterPartial!.status}`);
  assert(afterPartial!.amountPaidPaise === partialAmount * 100, "amount paid should reflect partial payment");
  console.log("   OK: status =", afterPartial!.status, "amountPaid =", afterPartial!.amountPaidPaise);

  console.log("8) Recording remaining payment…");
  const remainingPaise = invoice.totalPaise - partialAmount * 100;
  await paymentService.createPayment({
    customerId: customer.id,
    invoiceId: invoice.id,
    paymentDate: new Date().toISOString().slice(0, 10),
    amount: remainingPaise / 100,
    method: "BANK_TRANSFER",
    referenceNumber: "TESTUTR2",
    notes: "",
  });
  const afterFull = await getInvoiceDetail(invoice.id);
  assert(afterFull!.status === "PAID", `expected PAID, got ${afterFull!.status}`);
  assert(afterFull!.totalPaise - afterFull!.amountPaidPaise === 0, "outstanding should be 0");
  console.log("   OK: status =", afterFull!.status, "outstanding = 0");

  console.log("9) Verifying payments list contains both payments…");
  const { payments } = await paymentService.listPayments({ q: invoice.number });
  assert(payments.length === 2, `expected 2 payments for this invoice, got ${payments.length}`);
  console.log("   OK:", payments.length, "payments found for", invoice.number);

  console.log("10) Verifying dashboard & finance reflect the new revenue…");
  const summary = await getSummaryCards();
  const finance = await getFinanceOverview();
  assert(summary.revenuePaise >= invoice.totalPaise, "dashboard revenue should include this invoice's payments");
  assert(finance.revenuePaise >= invoice.totalPaise, "finance revenue should include this invoice's payments");
  console.log("   OK: dashboard revenue =", summary.revenuePaise, "finance revenue =", finance.revenuePaise);

  console.log("\n✅ ALL CHECKS PASSED — end-to-end flow verified.");
}

main()
  .catch((err) => {
    console.error("\n❌ TEST FLOW FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanupTestFlowData();
      console.log("Cleaned up test data.");
    } catch (err) {
      console.error("Cleanup failed — remove 'Test Flow Customer' records manually:", err);
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  });
