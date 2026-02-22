export function ReviewBotLogo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="6" fill="currentColor" className="text-terminal" />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontFamily="monospace"
        fontWeight="bold"
        fontSize="16"
        fill="#0a0a0a"
      >
        {">_"}
      </text>
    </svg>
  )
}
