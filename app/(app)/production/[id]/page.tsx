export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { getProductionJobDetail } from "@/lib/services/production";
import { ProductionDetail } from "@/components/production/production-detail";

export const metadata = { title: "Production Job Details — Priinteve Business OS" };

export default async function ProductionJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getProductionJobDetail(id);
  if (!job) notFound();

  return <ProductionDetail job={job} />;
}

