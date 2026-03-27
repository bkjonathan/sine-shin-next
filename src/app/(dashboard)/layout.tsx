import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Providers } from "@/components/providers";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { db } from "@/db";
import { shopSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const [settings] = await db.select().from(shopSettings).where(eq(shopSettings.id, "singleton")).limit(1);

  return (
    <Providers session={session}>
      <DashboardShell settings={settings}>{children}</DashboardShell>
    </Providers>
  );
}
