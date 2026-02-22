"use client"

import Link from "next/link"
import Image from "next/image"
import { Settings, LogOut } from "lucide-react"
import { useUser, useClerk } from "@clerk/nextjs"
import { ReviewBotLogo } from "@/components/reviewbot-logo"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

function getUserInitials(user: { firstName?: string | null; lastName?: string | null; primaryEmailAddress?: { emailAddress: string } | null }) {
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
  }
  if (user.firstName) {
    return user.firstName.slice(0, 2).toUpperCase()
  }
  const email = user.primaryEmailAddress?.emailAddress
  if (email) {
    return email.slice(0, 2).toUpperCase()
  }
  return "U"
}

export function DashboardHeader() {
  const { user } = useUser()
  const { signOut } = useClerk()

  const displayEmail = user?.primaryEmailAddress?.emailAddress ?? ""
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
                {user?.imageUrl && (
                  <AvatarImage src={user.imageUrl} alt={displayEmail} />
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
              onClick={() => signOut({ redirectUrl: "/" })}
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
