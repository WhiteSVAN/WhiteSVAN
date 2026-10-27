import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";

/** A trader's page is their customer page now, with billing and profile alongside their trading. */
export default async function AdminTraderPage({ params }: { params: Promise<{ userId: string }> }) {
  await requireAdmin();
  redirect(`/admin/customers/${(await params).userId}`);
}
