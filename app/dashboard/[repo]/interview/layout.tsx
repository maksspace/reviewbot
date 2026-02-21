export const metadata = {
  title: "Interview - ReviewBot",
  description: "Teach ReviewBot your team's standards and preferences.",
}

export default function InterviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Fixed full-screen overlay to escape the dashboard layout's header + padding
  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      {children}
    </div>
  )
}
