"use client";

/* eslint-disable @next/next/no-img-element */

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const getEloBadge = (rating: number) => {
  if (rating < 1100) return { name: "Iron", color: "text-[#a19e95] border-[#a19e95]/30 bg-[#a19e95]/10" };
  if (rating < 1300) return { name: "Bronze", color: "text-[#c27c38] border-[#c27c38]/30 bg-[#c27c38]/10" };
  if (rating < 1500) return { name: "Silver", color: "text-[#a5b2bc] border-[#a5b2bc]/30 bg-[#a5b2bc]/10" };
  if (rating < 1800) return { name: "Gold", color: "text-[#e5c158] border-[#e5c158]/30 bg-[#e5c158]/10" };
  if (rating < 2100) return { name: "Platinum", color: "text-[#4fc3f7] border-[#4fc3f7]/30 bg-[#4fc3f7]/10" };
  return { name: "Diamond", color: "text-[#e040fb] border-[#e040fb]/30 bg-[#e040fb]/10 shadow-[0_0_15px_rgba(224,64,251,0.25)] animate-pulse" };
};

export default function Navbar() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const player = session?.player;

  // Do not show Navbar on login page or when not signed in
  if (pathname === "/login" || !player) return null;

  const badge = getEloBadge(player.eloRating);

  const links = [
    { label: "Hub", href: "/hub" },
    { label: "Lobby", href: "/lobby" },
    { label: "Leaderboard", href: "/leaderboard" },
  ];

  return (
    <nav className="flex justify-between items-center px-8 py-4 border-b border-khaki/10 bg-surface/40 backdrop-blur-lg relative z-20 font-sans">
      {/* Logo */}
      <div className="flex items-center space-x-3 cursor-pointer" onClick={() => router.push("/hub")}>
        <div className="w-8 h-8 rounded bg-gradient-to-br from-sand to-olive flex items-center justify-center font-space font-black text-bg text-lg tracking-tighter">
          E
        </div>
        <h1 className="font-space text-2xl font-bold tracking-tight uppercase">
          EngineX <span className="text-sand font-light">Arena</span>
        </h1>
      </div>

      {/* Nav Links */}
      <div className="flex items-center space-x-8">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <button
              key={link.href}
              onClick={() => router.push(link.href)}
              className={`font-space text-sm uppercase tracking-wider font-semibold transition-all relative ${
                isActive ? "text-sand border-b border-sand pb-1" : "text-cream/80 hover:text-sand"
              }`}
            >
              {link.label}
            </button>
          );
        })}
      </div>

      {/* Profile Details */}
      <div className="flex items-center space-x-4">
        <div className="text-right">
          <button
            onClick={() => router.push(`/profile/${player.username}`)}
            className="font-space font-medium text-cream block hover:text-sand transition text-sm leading-tight text-right outline-none"
          >
            {player.username}
          </button>
          <div className="flex items-center space-x-1.5 justify-end mt-1">
            <span className={`px-1.5 py-0.25 border text-[8px] font-mono font-bold rounded uppercase tracking-wider ${badge.color}`}>
              {badge.name}
            </span>
            <span className="font-mono text-[9px] text-khaki">{player.eloRating} ELO</span>
          </div>
        </div>
        <img
          src={player.avatar}
          alt={player.username}
          onClick={() => router.push(`/profile/${player.username}`)}
          className="w-10 h-10 rounded-xl border border-khaki/20 hover:border-sand hover:scale-105 transition cursor-pointer object-cover"
        />
      </div>
    </nav>
  );
}
