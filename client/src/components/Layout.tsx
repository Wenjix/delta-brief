import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/onboarding", label: "1. Onboarding" },
    { href: "/checkin", label: "2. Check-in" },
    { href: "/brief", label: "3. Brief" },
    { href: "/history", label: "History" },
  ];

  return (
    <div className="min-h-screen bg-background font-sans text-foreground flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 border-b md:border-r border-border bg-sidebar p-6 flex flex-col shrink-0">
        <div className="mb-8">
          <h1 className="text-xl font-bold tracking-tight">Delta Brief</h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono">EMBA CLASS PREP</p>
        </div>

        <nav className="space-y-1 flex-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer",
                  location === item.href
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                )}
              >
                {item.label}
              </div>
            </Link>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-sidebar-border">
          <div className="text-xs text-muted-foreground">
            <p>User: u_demo</p>
            <p>Session: {new Date().toISOString().split('T')[0]}</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="h-full w-full p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
