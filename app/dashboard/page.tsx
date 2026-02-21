import { RepoTable } from "@/components/repo-table"
import Link from "next/link"

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">
            Your Repositories
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage connected repos and review personas.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center justify-center border border-terminal px-5 py-2.5 text-xs tracking-wider uppercase text-terminal transition-colors hover:bg-terminal hover:text-background"
        >
          Connect Repository
        </Link>
      </div>

      <RepoTable />
    </div>
  )
}
