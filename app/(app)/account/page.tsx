import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { ProfileForm } from "@/components/account/profile-form";
import { PasswordForm } from "@/components/account/password-form";
import { requireAuth } from "@/lib/auth/session";
import { getOwnAccount } from "@/lib/services/account";

export const metadata = { title: "My account" };
export const dynamic = "force-dynamic";

const ROLE_LABEL = { ADMIN: "Admin", EMPLOYEE: "Employee", CLIENT: "Client" } as const;

export default async function AccountPage() {
  let session;
  try {
    session = await requireAuth();
  } catch {
    redirect("/login");
  }

  const account = await getOwnAccount(session.id);
  if (!account) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="My account" description="Change your name and password." className="mb-0" />
      <ProfileForm defaultName={account.name} email={account.email} roleLabel={ROLE_LABEL[account.role]} />
      <PasswordForm />
    </div>
  );
}
