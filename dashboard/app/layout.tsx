import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oh My Agentic Score",
  description: "Oh My Agentic Score - Thread-Based Engineering Analytics",
  icons: {
    icon: "/favicon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gray-950 text-gray-100">
        <div className="flex">
          {/* Sidebar */}
          <nav className="w-56 min-h-screen bg-gray-900 border-r border-gray-800 p-4 flex flex-col gap-2">
            <h1 className="text-lg font-bold text-cyan-400 mb-6">
              OMAS
            </h1>
            <NavLink href="/" label="Overview" />
            <NavLink href="/sessions" label="Sessions" />
            <NavLink href="/projects" label="Projects" />
            <NavLink href="/tools" label="Tool Usage" />
            <NavLink href="/scoring" label="Scoring Guide" />
            <p className="text-xs text-gray-500 mt-auto pt-4 border-t border-gray-800">
              Thread-Based Engineering
            </p>
          </nav>

          {/* Main content */}
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 rounded-md text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
    >
      {label}
    </Link>
  );
}
