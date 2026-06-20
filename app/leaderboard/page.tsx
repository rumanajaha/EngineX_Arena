"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface LeaderboardPlayer {
  id: string;
  rank: number;
  username: string;
  avatar: string;
  githubUrl: string | null;
  eloRating: number;
  totalWins: number;
  totalLosses: number;
  weeklyWins: number;
  currentStreak: number;
  topMode: string;
  winRate: number;
}

const ShieldIcon = ({ color }: { color: string }) => (
  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill={color} stroke="none">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const getEloBadgeDetails = (rating: number) => {
  if (rating < 1100) return { name: "Iron", color: "#888888" };
  if (rating < 1300) return { name: "Bronze", color: "#CD7F32" };
  if (rating < 1500) return { name: "Silver", color: "#C0C0C0" };
  if (rating < 1800) return { name: "Gold", color: "#FFD700" };
  if (rating < 2100) return { name: "Platinum", color: "#4FC3F7" };
  return { name: "Diamond", color: "#B388FF" };
};

const getModeName = (mode: string) => {
  const map: Record<string, string> = {
    SYSTEM_CRASH: "System Crash",
    ARCH_WARS: "Arch Wars",
    LOAD_BREAKER: "Load Breaker",
  };
  return map[mode] || mode;
};

export default function LeaderboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const me = session?.player;

  const [activeTab, setActiveTab] = useState<string>("global"); // global, weekly, SYSTEM_CRASH, ARCH_WARS, LOAD_BREAKER
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [currentUserRow, setCurrentUserRow] = useState<LeaderboardPlayer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Weekly countdown timer state
  const [countdown, setCountdown] = useState<string>("");

  // Fetch leaderboard data
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/leaderboard?tab=${activeTab}`);
        if (res.ok) {
          const data = await res.json();
          setLeaderboard(data.leaderboard);
          setCurrentUserRow(data.currentUser);
        }
      } catch (err) {
        console.error("Error loading leaderboard:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, [activeTab]);

  // Weekly reset countdown timer logic
  useEffect(() => {
    if (activeTab !== "weekly") return;

    const getNextMondayUTC = () => {
      const now = new Date();
      const nextMonday = new Date(now);
      const day = now.getUTCDay();
      const daysToAdd = day === 0 ? 1 : 8 - day;
      nextMonday.setUTCDate(now.getUTCDate() + daysToAdd);
      nextMonday.setUTCHours(0, 0, 0, 0);
      return nextMonday.getTime();
    };

    const targetTime = getNextMondayUTC();

    const updateTimer = () => {
      const now = new Date().getTime();
      const difference = targetTime - now;

      if (difference <= 0) {
        setCountdown("Resetting scores...");
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [activeTab]);

  const isMeInTop100 = leaderboard.some((p) => p.id === me?.id);

  return (
    <div className="h-full overflow-y-auto bg-bg text-cream flex flex-col font-sans relative">
      {/* Sci-Fi Decorative Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(128,119,92,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(128,119,92,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-olive/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Main Container */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 flex flex-col space-y-6 relative z-10">
        {/* Title and Countdown Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-space text-3xl font-bold tracking-tight uppercase text-cream">LEADERBOARD</h2>
            <p className="text-xs text-khaki font-mono uppercase tracking-widest mt-1">Arena Elite Top 100 Rankings</p>
          </div>

          {/* Countdown timer for weekly reset */}
          <AnimatePresence>
            {activeTab === "weekly" && countdown && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-surface2/50 border border-sand/20 px-4 py-2.5 rounded-xl backdrop-blur-md flex items-center space-x-3"
              >
                <div className="w-2 h-2 rounded-full bg-sand animate-ping" />
                <div className="font-mono text-xs">
                  <span className="text-khaki uppercase tracking-widest block text-[9px] mb-0.5">Weekly Reset In</span>
                  <span className="text-cream font-bold">{countdown}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-khaki/10 flex space-x-2 overflow-x-auto pb-px">
          {[
            { id: "global", label: "Global ELO" },
            { id: "weekly", label: "This Week" },
            { id: "SYSTEM_CRASH", label: "System Crash" },
            { id: "ARCH_WARS", label: "Arch Wars" },
            { id: "LOAD_BREAKER", label: "Load Breaker" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-4 text-xs font-space font-bold uppercase tracking-wider transition border-b-2 relative ${
                activeTab === tab.id
                  ? "border-sand text-cream"
                  : "border-transparent text-khaki hover:text-cream"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table Leaderboard Container */}
        <div className="flex-1 bg-surface/30 border border-khaki/10 rounded-2xl overflow-hidden backdrop-blur-md flex flex-col">
          {/* Header Row */}
          <div className="grid grid-cols-12 px-6 py-4 border-b border-khaki/10 bg-surface2/20 text-[10px] font-mono uppercase tracking-widest text-khaki">
            <div className="col-span-1 text-center">Rank</div>
            <div className="col-span-4 pl-4">Player</div>
            <div className="col-span-2 text-center">Rating</div>
            <div className="col-span-2 text-center">W / L Ratio</div>
            <div className="col-span-1 text-center">Streak</div>
            <div className="col-span-2 text-right pr-2">Top Specialty</div>
          </div>

          {/* Body List */}
          <div className="flex-1 divide-y divide-khaki/5 overflow-y-auto max-h-[550px]">
            {isLoading ? (
              <div className="animate-pulse divide-y divide-khaki/5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="grid grid-cols-12 px-6 py-5 items-center bg-surface2/10">
                    <div className="col-span-1 h-6 bg-khaki/10 rounded w-8 mx-auto" />
                    <div className="col-span-4 pl-4 flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-khaki/15" />
                      <div className="h-4 bg-khaki/10 rounded w-24 animate-pulse" />
                    </div>
                    <div className="col-span-2 h-5 bg-khaki/10 rounded w-16 mx-auto" />
                    <div className="col-span-2 h-4 bg-khaki/10 rounded w-20 mx-auto" />
                    <div className="col-span-1 h-5 bg-khaki/10 rounded w-8 mx-auto" />
                    <div className="col-span-2 h-5 bg-khaki/10 rounded w-20 ml-auto mr-2" />
                  </div>
                ))}
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="py-24 text-center text-khaki font-mono text-sm uppercase tracking-wider">
                NO COMPETITOR SCORES LOGGED YET.
              </div>
            ) : (
              leaderboard.map((row) => {
                const badge = getEloBadgeDetails(row.eloRating);
                const isCurrentMe = row.id === me?.id;
                
                // Podium styling
                let podiumAccent = "border-l-4 border-l-transparent";
                if (row.rank === 1) podiumAccent = "border-l-4 border-l-[#FFD700] bg-gradient-to-r from-[#FFD700]/5 to-transparent";
                if (row.rank === 2) podiumAccent = "border-l-4 border-l-[#C0C0C0] bg-gradient-to-r from-[#C0C0C0]/5 to-transparent";
                if (row.rank === 3) podiumAccent = "border-l-4 border-l-[#CD7F32] bg-gradient-to-r from-[#CD7F32]/5 to-transparent";

                const totalMatches = row.totalWins + row.totalLosses;
                const winPercent = totalMatches > 0 ? (row.totalWins / totalMatches) * 100 : 50;

                return (
                  <div
                    key={row.id}
                    className={`grid grid-cols-12 px-6 py-4 items-center transition hover:bg-surface2/35 ${podiumAccent} ${
                      isCurrentMe ? "bg-sand/5" : ""
                    }`}
                  >
                    {/* Rank Badge */}
                    <div className="col-span-1 flex justify-center items-center">
                      <div className="flex flex-col items-center justify-center">
                        <span className="font-space font-bold text-sm text-cream mb-0.5">{row.rank}</span>
                        <ShieldIcon color={badge.color} />
                      </div>
                    </div>

                    {/* Player Info */}
                    <div className="col-span-4 pl-4 flex items-center space-x-3">
                      <img
                        src={row.avatar}
                        alt={row.username}
                        className="w-9 h-9 rounded-xl border border-khaki/20 object-cover flex-shrink-0 cursor-pointer hover:scale-105 transition"
                        onClick={() => router.push(`/profile/${row.username}`)}
                      />
                      <div className="truncate">
                        <span
                          className="font-space font-bold text-cream hover:text-sand cursor-pointer transition"
                          onClick={() => router.push(`/profile/${row.username}`)}
                        >
                          {row.username}
                        </span>
                        {row.githubUrl && (
                          <a
                            href={row.githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block font-mono text-[9px] text-khaki hover:text-sand transition w-fit mt-0.5"
                          >
                            github.profile
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="col-span-2 text-center font-mono text-sm font-semibold text-cream">
                      {activeTab === "weekly" ? `${row.weeklyWins} Wins` : `${row.eloRating} ELO`}
                    </div>

                    {/* W/L Ratio Bar */}
                    <div className="col-span-2 flex flex-col items-center">
                      <div className="w-24 h-2 bg-[#e57373]/20 rounded-full overflow-hidden flex shadow-inner">
                        <div className="h-full bg-[#81c784]" style={{ width: `${winPercent}%` }} />
                      </div>
                      <span className="font-mono text-[9px] text-khaki mt-1">
                        {row.totalWins}W - {row.totalLosses}L
                      </span>
                    </div>

                    {/* Streak */}
                    <div className="col-span-1 text-center font-mono text-sm text-cream">
                      {row.currentStreak > 0 ? `${row.currentStreak} 🔥` : "—"}
                    </div>

                    {/* Specialty Badge */}
                    <div className="col-span-2 text-right pr-2">
                      <span className="font-space text-[10px] font-bold uppercase tracking-wider text-sand border border-khaki/20 px-2 py-0.5 roundedbg-bg/40">
                        {row.topMode === "None" ? "None" : getModeName(row.topMode)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Pinned bottom row for own user if not in top 100 */}
        <AnimatePresence>
          {me && !isLoading && currentUserRow && !isMeInTop100 && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="bg-surface border-2 border-sand rounded-2xl p-4 shadow-xl relative z-10"
            >
              <div className="absolute -top-3 left-6 bg-sand text-bg font-space font-bold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded shadow">
                Your Pinned Standings
              </div>
              <div className="grid grid-cols-12 items-center">
                <div className="col-span-1 flex justify-center items-center">
                  <div className="flex flex-col items-center">
                    <span className="font-space font-bold text-sm text-cream mb-0.5">#{currentUserRow.rank}</span>
                    <ShieldIcon color={getEloBadgeDetails(currentUserRow.eloRating).color} />
                  </div>
                </div>

                <div className="col-span-4 pl-4 flex items-center space-x-3">
                  <img
                    src={currentUserRow.avatar}
                    alt={currentUserRow.username}
                    className="w-9 h-9 rounded-xl border border-khaki/20 object-cover flex-shrink-0 cursor-pointer"
                    onClick={() => router.push(`/profile/${currentUserRow.username}`)}
                  />
                  <div>
                    <span
                      className="font-space font-bold text-cream hover:text-sand cursor-pointer transition block"
                      onClick={() => router.push(`/profile/${currentUserRow.username}`)}
                    >
                      {currentUserRow.username} (You)
                    </span>
                    {currentUserRow.githubUrl && (
                      <a
                        href={currentUserRow.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[9px] text-khaki hover:text-sand transition"
                      >
                        github.profile
                      </a>
                    )}
                  </div>
                </div>

                <div className="col-span-2 text-center font-mono text-sm font-semibold text-cream">
                  {activeTab === "weekly" ? `${currentUserRow.weeklyWins} Wins` : `${currentUserRow.eloRating} ELO`}
                </div>

                <div className="col-span-2 flex flex-col items-center">
                  <div className="w-24 h-2 bg-[#e57373]/20 rounded-full overflow-hidden flex shadow-inner">
                    <div
                      className="h-full bg-[#81c784]"
                      style={{ width: `${(currentUserRow.totalWins / (currentUserRow.totalWins + currentUserRow.totalLosses || 1)) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-[9px] text-khaki mt-1">
                    {currentUserRow.totalWins}W - {currentUserRow.totalLosses}L
                  </span>
                </div>

                <div className="col-span-1 text-center font-mono text-sm text-cream">
                  {currentUserRow.currentStreak > 0 ? `${currentUserRow.currentStreak} 🔥` : "—"}
                </div>

                <div className="col-span-2 text-right pr-2">
                  <span className="font-space text-[10px] font-bold uppercase tracking-wider text-sand border border-khaki/20 px-2 py-0.5 rounded bg-bg/40">
                    {currentUserRow.topMode === "None" ? "None" : getModeName(currentUserRow.topMode)}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
