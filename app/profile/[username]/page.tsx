import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }> | { username: string };
}) {
  try {
    const resolvedParams = await params;
    const username = resolvedParams?.username;

    if (!username) {
      return (
        <div className="min-h-screen bg-[#0D0D0A] text-[#FAE8B4] flex flex-col items-center justify-center font-sans p-6">
          <div className="max-w-md w-full bg-[#1A1A14] border border-[#80775C]/20 rounded-2xl p-8 text-center space-y-6">
            <h2 className="text-xl font-bold font-space text-red-500 uppercase">Invalid Username</h2>
            <p className="text-xs text-[#80775C]">No username parameter was supplied in the URL.</p>
            <Link
              href="/hub"
              className="inline-block w-full bg-[#CBBD93] hover:bg-[#FAE8B4] text-[#0D0D0A] font-space font-bold uppercase text-xs py-3.5 rounded-lg text-center transition"
            >
              Return to Hub
            </Link>
          </div>
        </div>
      );
    }

    const player = await prisma.player.findFirst({
      where: {
        username: {
          equals: username,
          mode: "insensitive",
        },
      },
    });

    if (!player) {
      return (
        <div className="min-h-screen bg-[#0D0D0A] text-[#FAE8B4] flex flex-col items-center justify-center font-sans p-6">
          <div className="max-w-md w-full bg-[#1A1A14] border border-[#80775C]/20 rounded-2xl p-8 text-center space-y-6">
            <h2 className="text-xl font-bold font-space text-red-500 uppercase">Player Not Found</h2>
            <p className="text-xs text-[#80775C]">The player &quot;@{username}&quot; is not registered in the database.</p>
            <Link
              href="/hub"
              className="inline-block w-full bg-[#CBBD93] hover:bg-[#FAE8B4] text-[#0D0D0A] font-space font-bold uppercase text-xs py-3.5 rounded-lg text-center transition"
            >
              Return to Hub
            </Link>
          </div>
        </div>
      );
    }

    const memberSince = new Date(player.createdAt).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return (
      <div className="min-h-screen bg-[#0D0D0A] text-[#FAE8B4] flex flex-col items-center justify-center font-sans p-6">
        {/* Sci-Fi Decorative Background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(128,119,92,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(128,119,92,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
        
        <div className="relative z-10 max-w-lg w-full bg-[#1A1A14] border border-[#80775C]/20 rounded-2xl p-8 shadow-2xl space-y-8">
          {/* Main profile card */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <img
              src={player.avatar || "https://github.com/identicons/guest.png"}
              alt={player.username}
              className="w-24 h-24 rounded-2xl border-2 border-[#80775C]/20 object-cover shadow-lg"
            />
            <div className="space-y-3 text-center sm:text-left flex-1">
              <h1 className="text-3xl font-extrabold font-space tracking-tight text-[#CBBD93] break-all">
                {player.username}
              </h1>
              <p className="text-xs text-[#80775C] font-mono">
                Member since {memberSince}
              </p>
              {player.bio && (
                <p className="text-xs text-cream/70 italic leading-relaxed font-sans mt-2">
                  {player.bio}
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-[#80775C]/15" />

          {/* Stats section */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-[#0D0D0A]/50 border border-[#80775C]/10 rounded-xl p-3">
              <p className="text-[9px] uppercase font-mono text-[#80775C] tracking-wider mb-1">ELO Rating</p>
              <p className="text-lg font-bold font-space text-[#CBBD93]">{player.eloRating}</p>
            </div>
            <div className="bg-[#0D0D0A]/50 border border-[#80775C]/10 rounded-xl p-3">
              <p className="text-[9px] uppercase font-mono text-[#80775C] tracking-wider mb-1">Total Wins</p>
              <p className="text-lg font-bold font-space text-green-500">{player.totalWins}</p>
            </div>
            <div className="bg-[#0D0D0A]/50 border border-[#80775C]/10 rounded-xl p-3">
              <p className="text-[9px] uppercase font-mono text-[#80775C] tracking-wider mb-1">Total Losses</p>
              <p className="text-lg font-bold font-space text-red-500">{player.totalLosses}</p>
            </div>
          </div>

          {/* Badges section */}
          <div className="space-y-3">
            <p className="text-[10px] font-mono uppercase text-[#80775C] tracking-widest font-bold">Earned Badges</p>
            {player.badges && player.badges.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {player.badges.map((badgeName) => (
                  <span
                    key={badgeName}
                    className="px-3 py-1 bg-[#574A24]/30 border border-[#CBBD93]/30 text-[#CBBD93] text-xs font-mono font-bold rounded-full uppercase tracking-wider"
                  >
                    {badgeName}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#80775C] italic">No badges yet</p>
            )}
          </div>

          <div className="border-t border-[#80775C]/15 pt-2" />

          {/* Action buttons */}
          <div className="flex gap-4">
            <Link
              href="/hub"
              className="flex-1 bg-[#CBBD93] hover:bg-[#FAE8B4] text-[#0D0D0A] font-space font-bold uppercase text-xs py-3 rounded-lg text-center transition"
            >
              Return to Hub
            </Link>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Failed to load player profile page:", error);
    return (
      <div className="min-h-screen bg-[#0D0D0A] text-[#FAE8B4] flex flex-col items-center justify-center font-sans p-6">
        <div className="max-w-md w-full bg-[#1A1A14] border border-[#80775C]/20 rounded-2xl p-8 text-center space-y-6">
          <h2 className="text-xl font-bold font-space text-red-500 uppercase">Database Error</h2>
          <p className="text-xs text-[#80775C]">Failed to fetch profile details from database.</p>
          <Link
            href="/hub"
            className="inline-block w-full bg-[#CBBD93] hover:bg-[#FAE8B4] text-[#0D0D0A] font-space font-bold uppercase text-xs py-3.5 rounded-lg text-center transition"
          >
            Return to Hub
          </Link>
        </div>
      </div>
    );
  }
}
