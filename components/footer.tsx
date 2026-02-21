export function Footer() {
  return (
    <footer className="border-t border-border px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="text-terminal">{">_"}</span>
          <span>ReviewBot</span>
        </div>

        <div className="flex items-center gap-6">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            GitHub
          </a>
          <a
            href="#"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Docs
          </a>
          <span className="text-xs text-muted-foreground/50">
            Built with care
          </span>
        </div>
      </div>
    </footer>
  )
}
