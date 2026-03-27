import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Providers } from "@/components/providers";
import { db } from "@/db";
import { shopSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const [settings] = await db.select().from(shopSettings).where(eq(shopSettings.id, "singleton")).limit(1);

  return (
    <Providers session={session}>
      <div className="min-h-screen flex bg-[#0a0a0f]">
        {/* Background gradients */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-[#007AFF]/6 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-3xl" />
        </div>

        <Sidebar settings={settings} />

        <div className="flex-1 flex flex-col min-w-0 relative">
          <Topbar />
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </Providers>
  );
}
