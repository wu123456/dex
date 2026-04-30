"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: "/swap", label: "Swap" },
    { href: "/liquidity", label: "Liquidity" },
    { href: "/limit-order", label: "Limit" },
    { href: "/governance", label: "Govern" },
    { href: "/farming", label: "Farm" },
  ];

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
      <div className="flex items-center gap-8">
        <Link href="/" className="text-xl font-bold text-indigo-400">
          DEX
        </Link>
        <div className="flex gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === link.href
                  ? "bg-indigo-600 text-white"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      <ConnectButton />
    </nav>
  );
}
