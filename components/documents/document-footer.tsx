import type { CompanySettings } from "@prisma/client";

export function DocumentFooter({ company }: { company: CompanySettings }) {
  const hasBankDetails = company.bankName || company.bankAccountNumber;

  return (
    <div className="mt-8 flex flex-wrap items-end justify-between gap-6 border-t border-gray-200 pt-5">
      {hasBankDetails ? (
        <div className="text-xs text-gray-500">
          <p className="mb-1 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">Bank Details</p>
          {company.bankAccountName && <p>Account Name: {company.bankAccountName}</p>}
          {company.bankName && <p>Bank: {company.bankName}{company.bankBranch ? `, ${company.bankBranch}` : ""}</p>}
          {company.bankAccountNumber && <p>Account No: {company.bankAccountNumber}</p>}
          {company.bankIfsc && <p>IFSC: {company.bankIfsc}</p>}
        </div>
      ) : (
        <div />
      )}
      <p className="text-xs text-gray-400">Thank you for your business — {company.name}</p>
    </div>
  );
}
