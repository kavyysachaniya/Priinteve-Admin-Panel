import type { Customer } from "@prisma/client";

export function CustomerDetails({ customer }: { customer: Customer }) {
  const cityLine = [customer.city, customer.state, customer.pincode].filter(Boolean).join(", ");

  return (
    <div className="text-xs text-gray-500">
      <p className="mb-1 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">Bill To</p>
      <p className="font-medium text-gray-800">{customer.name}</p>
      {customer.type === "BUSINESS" && customer.contactPerson && <p>Attn: {customer.contactPerson}</p>}
      {customer.billingAddress && <p>{customer.billingAddress}</p>}
      {cityLine && <p>{cityLine}</p>}
      <p>Phone: {customer.phone}</p>
      {customer.email && <p>Email: {customer.email}</p>}
      {customer.gstin && <p>GSTIN: {customer.gstin}</p>}
    </div>
  );
}
