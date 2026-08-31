export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { getDeliveryDetail } from "@/lib/services/deliveries";
import { DeliveryDetail } from "@/components/deliveries/delivery-detail";

export const metadata = { title: "Delivery Overview — Priinteve Business OS" };

export default async function DeliveryDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const delivery = await getDeliveryDetail(id);

  if (!delivery) {
    notFound();
  }

  return <DeliveryDetail delivery={delivery} />;
}

