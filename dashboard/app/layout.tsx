"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./globals.css";

/** Pencil sidebar nav items with lucide icon names. */
const NAV_ITEMS = [
  { href: "/", label: "OVERVIEW", icon: "layout-dashboard" },
  { href: "/sessions", label: "SESSIONS", icon: "list" },
  { href: "/projects", label: "PROJECTS", icon: "folder" },
  { href: "/tools", label: "TOOL USAGE", icon: "wrench" },
  { href: "/scoring", label: "SCORING GUIDE", icon: "book-open" },
] as const;

/** SVG icons matching Pencil lucide icon set. */
function NavIcon({ name }: { name: string }) {
  const props = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (name) {
    case "layout-dashboard":
      return <svg {...props}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>;
    case "list":
      return <svg {...props}><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>;
    case "folder":
      return <svg {...props}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>;
    case "wrench":
      return <svg {...props}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>;
    case "book-open":
      return <svg {...props}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>;
    default:
      return <svg {...props}><circle cx="12" cy="12" r="10" /></svg>;
  }
}

/** Pencil P7 sidebar nav link with icon + ALL CAPS label. */
function SidebarLink({ href, label, icon, isActive }: {
  href: string;
  label: string;
  icon: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-2.5 text-xs font-mono tracking-wider transition-colors"
      style={{
        color: isActive ? "#00FF88" : "#8a8a8a",
        backgroundColor: isActive ? "#00FF8810" : "transparent",
        fontWeight: isActive ? 600 : 500,
      }}
    >
      <NavIcon name={icon} />
      {label}
    </Link>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <html lang="ko">
      <head>
        <title>Oh My Agentic Score</title>
        <meta name="description" content="Oh My Agentic Score - Thread-Based Engineering Analytics" />
        <link rel="icon" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        {/* JetBrains Mono + Space Grotesk — Pencil design fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ background: "#0C0C0C", fontFamily: "'JetBrains Mono', monospace" }} className="min-h-screen text-gray-100">
        <div className="flex">
          {/* Sidebar — Pencil #080808 */}
          <nav
            className="w-60 min-h-screen flex flex-col gap-8 p-5"
            style={{ background: "#080808" }}
          >
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00FF88" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
              <span className="text-base font-semibold tracking-widest" style={{ color: "#00FF88", fontFamily: "'JetBrains Mono', monospace" }}>
                OMAS
              </span>
            </div>

            {/* Nav items */}
            <div className="flex flex-col gap-0.5">
              {NAV_ITEMS.map((item) => (
                <SidebarLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  isActive={pathname === item.href}
                />
              ))}
            </div>
          </nav>

          {/* Main content — Pencil #0C0C0C, padding 40/48 */}
          <main className="flex-1 overflow-auto" style={{ padding: "40px 48px" }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
