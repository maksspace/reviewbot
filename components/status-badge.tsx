import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

type Status = "active" | "interview" | "analyzing" | "paused"

const statusConfig: Record<
  Status,
  { label: string; dotClass: string; textClass: string }
> = {
  active: {
    label: "Active",
    dotClass: "bg-terminal",
    textClass: "text-terminal",
  },
  interview: {
    label: "Interview",
    dotClass: "bg-terminal-warn",
    textClass: "text-terminal-warn",
  },
  analyzing: {
    label: "Analyzing",
    dotClass: "",
    textClass: "text-muted-foreground",
  },
  paused: {
    label: "Paused",
    dotClass: "bg-muted-foreground",
    textClass: "text-muted-foreground",
  },
}

export function StatusBadge({ status }: { status: Status }) {
  const config = statusConfig[status]

  return (
    <span className={cn("inline-flex items-center gap-2 text-xs", config.textClass)}>
      {status === "analyzing" ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <span className={cn("size-2 rounded-full", config.dotClass)} />
      )}
      {config.label}
    </span>
  )
}
