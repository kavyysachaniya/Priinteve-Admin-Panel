import type { CompanySettings } from "@prisma/client";

export function CompanyDetails({ company }: { company: CompanySettings }) {
  const addressLines = [company.addressLine1, company.addressLine2].filter(Boolean);
  const cityLine = [company.city, company.state, company.pincode].filter(Boolean).join(", ");

  return (
    <div className="text-xs text-gray-500">
      <p className="mb-1 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">From</p>
      <p className="font-medium text-gray-800">{company.name}</p>
      {addressLines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {cityLine && <p>{cityLine}</p>}
      {company.phone && <p>Phone: {company.phone}</p>}
      {company.email && <p>Email: {company.email}</p>}
      {company.gstin && <p>GSTIN: {company.gstin}</p>}
    </div>
  );
}
