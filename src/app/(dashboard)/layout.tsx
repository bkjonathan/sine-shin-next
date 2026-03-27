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
      <div className="min-h-screen flex bg-page transition-colors duration-300">
        {/* Background gradient blobs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full blur-3xl"
            style={{ background: "var(--gradient-blob-1)" }}
          />
          <div
            className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] rounded-full blur-3xl"
            style={{ background: "var(--gradient-blob-2)" }}
          />
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
