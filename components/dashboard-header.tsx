"use client"

import Link from "next/link"
import { Settings, LogOut, User } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function DashboardHeader() {
  return (
    <header className="border-b border-border bg-background">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/dashboard" className="flex items-center gap-2 text-foreground">
          <span className="text-terminal">{">_"}</span>
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
              <span className="hidden text-xs sm:block">dev@acme.co</span>
              <Avatar className="size-7 rounded-sm">
                <AvatarFallback className="rounded-sm bg-secondary text-xs text-secondary-foreground">
                  DA
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
            <DropdownMenuItem asChild>
              <Link href="/" className="flex items-center gap-2 text-destructive-foreground">
                <LogOut className="size-3.5" />
                <span>Sign out</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </header>
  )
}
