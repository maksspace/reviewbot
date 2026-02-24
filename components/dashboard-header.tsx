"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Settings, LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import { ReviewBotLogo } from "@/components/reviewbot-logo"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

function getUserInitials(user: User) {
  const fullName = user.user_metadata?.full_name as string | undefined
  if (fullName) {
    const parts = fullName.split(" ")
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    }
    return fullName.slice(0, 2).toUpperCase()
  }
  const email = user.email
  if (email) {
    return email.slice(0, 2).toUpperCase()
  }
  return "U"
}

export function DashboardHeader() {
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })
  }, [])

  const handleSignOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" })
    router.push("/")
  }

  const displayEmail = user?.email ?? ""
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined
  const initials = user ? getUserInitials(user) : "..."

  return (
    <header className="border-b border-border bg-background">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/dashboard" className="flex items-center gap-2 text-foreground">
          <ReviewBotLogo size={24} />
          <span className="text-sm font-bold tracking-wider uppercase">
            ReviewBot
          </span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-3 text-sm text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
            >
              <span className="hidden text-xs sm:block">{displayEmail}</span>
              <Avatar className="size-7 rounded-sm">
                {avatarUrl && (
                  <AvatarImage src={avatarUrl} alt={displayEmail} />
                )}
                <AvatarFallback className="rounded-sm bg-secondary text-xs text-secondary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card border-border">
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings" className="flex items-center gap-2">
                <Settings className="size-3.5" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="flex items-center gap-2 text-destructive-foreground cursor-pointer"
            >
              <LogOut className="size-3.5" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </header>
  )
}
