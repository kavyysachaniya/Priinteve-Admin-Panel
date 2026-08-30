"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createJournalEntryAction } from "@/lib/actions/journal";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, AlertCircle } from "lucide-react";

interface AccountOption {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface FormLine {
  accountId: string;
  debit: string;
  credit: string;
  description: string;
}

export function JournalForm({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<FormLine[]>([
    { accountId: "", debit: "", credit: "", description: "" },
    { accountId: "", debit: "", credit: "", description: "" },
  ]);

  // Calculations
  const totalDebit = lines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);
  const diff = Math.abs(totalDebit - totalCredit);
  const isBalanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.005;

  const handleLineChange = (index: number, field: keyof FormLine, value: string) => {
    const updated = [...lines];
    if (field === "debit" && value !== "") {
      updated[index].debit = value;
      updated[index].credit = ""; // Line cannot have both
    } else if (field === "credit" && value !== "") {
      updated[index].credit = value;
      updated[index].debit = "";  // Line cannot have both
    } else {
      updated[index][field] = value;
    }
    setLines(updated);
  };

  const addLine = () => {
    setLines([...lines, { accountId: "", debit: "", credit: "", description: "" }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) {
      toast.error("A journal entry requires at least 2 lines.");
      return;
    }
    setLines(lines.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }
    if (!isBalanced) {
      toast.error("Journal entry must be balanced (Total Debits = Total Credits > 0)");
      return;
    }

    // Validate lines
    for (const [idx, line] of lines.entries()) {
      if (!line.accountId) {
        toast.error(`Please select an account for line ${idx + 1}`);
        return;
      }
      const debVal = parseFloat(line.debit) || 0;
      const credVal = parseFloat(line.credit) || 0;
      if (debVal === 0 && credVal === 0) {
        toast.error(`Line ${idx + 1} must have either a debit or a credit amount`);
        return;
      }
    }

    setLoading(true);
    const res = await createJournalEntryAction({
      date,
      description,
      reference,
      lines: lines.map((l) => ({
        accountId: l.accountId,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        description: l.description,
      })),
    });
    setLoading(false);

    if (res.success) {
      toast.success("Journal entry posted successfully");
      router.push("/accounting/journal");
    } else {
      toast.error(res.message || "Failed to post journal entry");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header Fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
            Journal Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full text-xs px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Owner Capital investment"
            className="w-full text-xs px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
            Reference / Memo
          </label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Optional invoice/receipt info"
            className="w-full text-xs px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Lines Grid */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
          Journal Lines
        </h4>

        <div className="border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-muted/30 border-b text-[10px] uppercase font-bold text-muted-foreground">
              <tr>
                <th className="p-3 w-1/3">Account</th>
                <th className="p-3 w-1/4 text-right">Debit (₹)</th>
                <th className="p-3 w-1/4 text-right">Credit (₹)</th>
                <th className="p-3">Memo</th>
                <th className="p-3 w-[50px]"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/5">
                  <td className="p-2">
                    <select
                      value={line.accountId}
                      onChange={(e) => handleLineChange(idx, "accountId", e.target.value)}
                      className="w-full border rounded px-2 py-1 bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
                      required
                    >
                      <option value="">Select Account</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name} ({a.type})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={line.debit}
                      onChange={(e) => handleLineChange(idx, "debit", e.target.value)}
                      className="w-full text-right border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={line.credit}
                      onChange={(e) => handleLineChange(idx, "credit", e.target.value)}
                      className="w-full text-right border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      placeholder="Optional memo"
                      value={line.description}
                      onChange={(e) => handleLineChange(idx, "description", e.target.value)}
                      className="w-full border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={addLine}
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80"
        >
          <Plus className="size-3.5" /> Add Line
        </button>
      </div>

      {/* Balancing & Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-t pt-4">
        {/* Balancing indicators */}
        <div className="flex flex-wrap gap-4 text-xs font-mono">
          <div>
            <span className="text-muted-foreground block text-[10px] uppercase font-sans">Total Debits</span>
            <span className="font-bold text-foreground">₹{totalDebit.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[10px] uppercase font-sans">Total Credits</span>
            <span className="font-bold text-foreground">₹{totalCredit.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[10px] uppercase font-sans">Difference</span>
            <span className={`font-bold ${diff > 0.005 ? "text-red-500" : "text-emerald-500"}`}>
              ₹{diff.toFixed(2)}
            </span>
          </div>
          <div className="flex items-end h-full">
            {isBalanced ? (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                Balanced
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                <AlertCircle className="size-3" /> Unbalanced
              </span>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 w-full md:w-auto justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/accounting/journal")}
            disabled={loading}
            size="sm"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !isBalanced} size="sm">
            {loading ? "Posting..." : "Post Journal"}
          </Button>
        </div>
      </div>
    </form>
  );
}
