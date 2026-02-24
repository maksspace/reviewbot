import { DashboardHeader } from "@/components/dashboard-header"

export const metadata = {
  title: "Dashboard - ReviewBot",
  description: "Manage your connected repositories and review personas.",
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  )
}
