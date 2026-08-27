// One-off verification script for the Phase 1 core business flow (spec §19).
// Exercises the real service layer against the dev SQLite DB — the same
// functions the UI calls — end to end: Customer → Product → Quotation →
// Accept → Convert to Invoice → Partial Payment → Full Payment → Dashboard.
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

async function main() {
  console.log("1) Creating customer…");
  const customer = await customerService.createCustomer({
    type: "INDIVIDUAL",
    name: "Test Flow Customer",
    contactPerson: "",
    phone: "9876543210",
    whatsapp: "",
    email: "testflow@example.com",
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
    name: "Digital Business Card",
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
    await prisma.$disconnect();
  });
