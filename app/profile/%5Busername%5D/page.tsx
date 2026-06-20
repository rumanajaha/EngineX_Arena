"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { useToast } from "@/components/providers/ToastProvider";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

interface Player {
  id: string;
  username: string;
  avatar: string;
  bio: string | null;
  eloRating: number;
  totalWins: number;
  totalLosses: number;
  currentStreak: number;
  badges: string[];
  createdAt: string;
}

interface Battle {
  id: string;
  roomId: string;
  mode: string;
  status: string;
  player1: { id: string; username: string; avatar: string; eloRating: number };
  player2: { id: string; username: string; avatar: string; eloRating: number } | null;
  winner: { id: string; username: string } | null;
  winnerId: string | null;
  endedAt: string;
}

interface RadarStat {
  subject: string;
  A: number;
  fullMark: number;
}

interface BadgeInfo {
  id: string;
  name: string;
  desc: string;
  icon: React.ReactNode;
}

const getEloBadge = (rating: number) => {
  if (rating < 1100) return { name: "Iron", color: "text-[#a19e95] border-[#a19e95]/30 bg-[#a19e95]/10" };
  if (rating < 1300) return { name: "Bronze", color: "text-[#c27c38] border-[#c27c38]/30 bg-[#c27c38]/10" };
  if (rating < 1500) return { name: "Silver", color: "text-[#a5b2bc] border-[#a5b2bc]/30 bg-[#a5b2bc]/10" };
  if (rating < 1800) return { name: "Gold", color: "text-[#e5c158] border-[#e5c158]/30 bg-[#e5c158]/10" };
  if (rating < 2100) return { name: "Platinum", color: "text-[#4fc3f7] border-[#4fc3f7]/30 bg-[#4fc3f7]/10" };
  return { name: "Diamond", color: "text-[#e040fb] border-[#e040fb]/30 bg-[#e040fb]/10 shadow-[0_0_15px_rgba(224,64,251,0.25)] animate-pulse" };
};

const getModeName = (mode: string) => {
  const map: Record<string, string> = {
    SYSTEM_CRASH: "System Crash",
    ARCH_WARS: "Arch Wars",
    LOAD_BREAKER: "Load Breaker",
  };
  return map[mode] || mode;
};

// Custom Badge SVGs
const badgeList: BadgeInfo[] = [
  {
    id: "First Blood",
    name: "First Blood",
    desc: "Win 1 match in the arena.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-3.75-3.75m3.75 3.75l7.5-7.5" />
      </svg>
    ),
  },
  {
    id: "Hat Trick",
    name: "Hat Trick",
    desc: "Reach a win streak of 3.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: "Unbreakable",
    name: "Unbreakable",
    desc: "Reach a win streak of 10.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    id: "Architect",
    name: "Architect",
    desc: "Win 10 matches in Arch Wars.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    id: "Exterminator",
    name: "Exterminator",
    desc: "Win 10 matches in System Crash.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  {
    id: "Speedrun",
    name: "Speedrun",
    desc: "Solve a Load Breaker challenge in under 60 seconds.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "Centurion",
    name: "Centurion",
    desc: "Complete 100 total matches.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    id: "Elite",
    name: "Elite",
    desc: "Reach a rating of 1600 ELO.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
  },
];

export default function ProfilePage() {
  const { username } = useParams() as { username: string };
  const { data: session } = useSession();
  const router = useRouter();
  const me = session?.player;
  const { showToast } = useToast();

  // Socket
  const socketRef = useRef<Socket | null>(null);

  // States
  const [player, setPlayer] = useState<Player | null>(null);
  const [battles, setBattles] = useState<Battle[]>([]);
  const [radarStats, setRadarStats] = useState<RadarStat[]>([]);
  const [bestMode, setBestMode] = useState<string>("None");
  const [isLoading, setIsLoading] = useState(true);

  // Bio editor modal
  const [isEditBioOpen, setIsEditBioOpen] = useState(false);
  const [bioInput, setBioInput] = useState("");
  const [isSavingBio, setIsSavingBio] = useState(false);

  // Friend challenge modal
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);
  const [challengeMode, setChallengeMode] = useState("SYSTEM_CRASH");

  // Hover states for tooltips
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null);

  const isOwnProfile =
    me?.username && username && typeof username === "string"
      ? me.username.toLowerCase() === username.toLowerCase()
      : false;

  // Fetch profile details
  const fetchProfile = useCallback(async () => {
    if (!username || typeof username !== "string") return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/profile/${username}`);
      if (res.ok) {
        const data = await res.json();
        setPlayer(data.player);
        setBattles(data.battles);
        setRadarStats(data.radarStats);
        setBestMode(data.bestMode);
        setBioInput(data.player.bio || "");
      } else {
        router.push("/hub");
      }
    } catch (err) {
      console.error("Error loading profile:", err);
    } finally {
      setIsLoading(false);
    }
  }, [username, router]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Handle socket setup
  useEffect(() => {
    if (!me) return;

    const socket = io("http://localhost:3001");
    socketRef.current = socket;

    socket.emit("join:lobby", me.id);

    socket.on("room:ready", (data: { battleId: string; roomId: string; redirectUrl: string }) => {
      router.push(`/battle/${data.roomId}`);
    });

    return () => {
      socket.disconnect();
    };
  }, [me, router]);

  // Submit Bio changes
  const handleSaveBio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!player) return;
    setIsSavingBio(true);

    try {
      const res = await fetch(`/api/profile/${username}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: bioInput.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setPlayer(data.player);
        setIsEditBioOpen(false);
        showToast("Bio Updated", "Your profile bio was successfully updated.", "success");
      }
    } catch (err) {
      console.error("Error saving bio:", err);
    } finally {
      setIsSavingBio(false);
    }
  };

  // Challenge Friend Flow
  const handleLaunchChallenge = () => {
    if (!me || !player || !socketRef.current) return;

    const mode = challengeMode;
    // 1. Create a private room
    socketRef.current.emit(
      "create:room",
      {
        playerId: me.id,
        mode,
        difficulty: "MEDIUM",
        isPrivate: true,
      },
      (res: { roomId: string; inviteCode: string }) => {
        // 2. Emit challenge event to the target player
        socketRef.current?.emit("challenge:friend", {
          challengerId: me.id,
          friendId: player.id,
          mode,
          roomId: res.roomId,
        });

        setIsChallengeModalOpen(false);
        showToast("Duel Invite Sent", `Challenged @${player.username} to a duel link.`, "success");
        router.push(`/lobby`);
      }
    );
  };

  const getRelativeTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.round(diffHr / 24)}d ago`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg text-cream flex flex-col font-sans overflow-x-hidden relative">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(128,119,92,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(128,119,92,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
        <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-olive/5 blur-[120px] rounded-full pointer-events-none" />

        <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-8 relative z-10 animate-pulse">
          {/* PROFILE CARD SKELETON */}
          <div className="bg-surface/50 border border-khaki/10 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center space-x-6">
              <div className="w-24 h-24 rounded-2xl bg-surface2/60 border border-khaki/20" />
              <div className="space-y-2">
                <div className="h-8 w-48 bg-khaki/20 rounded animate-pulse" />
                <div className="h-4 w-32 bg-khaki/10 rounded animate-pulse" />
                <div className="h-4 w-64 bg-khaki/10 rounded animate-pulse" />
              </div>
            </div>
            <div className="w-28 h-10 bg-khaki/15 rounded-xl" />
          </div>

          {/* STATS & RADAR SKELETON */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-surface/40 border border-khaki/10 rounded-xl p-4 h-20" />
                ))}
              </div>
              <div className="bg-surface/30 border border-khaki/10 rounded-2xl p-6 h-72" />
            </div>
            <div className="lg:col-span-4 bg-surface/30 border border-khaki/10 rounded-2xl p-6 h-96" />
          </div>

          {/* HISTORY SKELETON */}
          <div className="space-y-4">
            <div className="h-6 w-32 bg-khaki/20 rounded" />
            <div className="bg-surface/30 border border-khaki/10 rounded-2xl h-64" />
          </div>
        </main>
      </div>
    );
  }

  if (!player) return null;

  const totalMatches = player.totalWins + player.totalLosses;
  const winRate = totalMatches > 0 ? Math.round((player.totalWins / totalMatches) * 100) : 0;
  const badge = getEloBadge(player.eloRating);

  return (
    <div className="h-full overflow-y-auto bg-bg text-cream flex flex-col font-sans relative">
      {/* Sci-Fi Background decorations */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(128,119,92,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(128,119,92,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-olive/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Main Grid */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-8 relative z-10">
        
        {/* Profile Card Info Header */}
        <section className="bg-surface/50 border border-khaki/10 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-sand/20 to-transparent" />
          
          <div className="flex items-center space-x-6">
            <img
              src={player.avatar}
              alt={player.username}
              className="w-24 h-24 rounded-2xl border-2 border-khaki/20 bg-surface2/60 shadow-lg object-cover flex-shrink-0"
            />
            <div className="space-y-2">
              <div className="flex items-baseline space-x-3">
                <h2 className="font-space text-3xl font-bold tracking-tight text-cream">{player.username}</h2>
                <a
                  href={`https://github.com/${player.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 bg-surface2/80 rounded border border-khaki/20 hover:border-sand hover:scale-105 transition text-khaki hover:text-cream"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482C19.138 20.197 22 16.44 22 12.017 22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                </a>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className={`px-2.5 py-0.5 border text-xs font-mono font-bold rounded uppercase tracking-wider ${badge.color}`}>
                  {badge.name} Division
                </span>
                <span className="font-mono text-xs text-khaki">
                  Joined {new Date(player.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long" })}
                </span>
              </div>

              <p className="text-xs text-cream/80 max-w-xl font-sans italic leading-relaxed">
                {player.bio || "This combatant has not configured a system bio yet."}
              </p>
            </div>
          </div>

          <div className="flex-shrink-0">
            {isOwnProfile ? (
              <button
                onClick={() => setIsEditBioOpen(true)}
                className="border border-khaki/20 hover:border-sand hover:text-bg hover:bg-cream text-cream/80 px-5 py-2.5 rounded-xl font-space font-semibold text-xs uppercase tracking-wider transition cursor-pointer"
              >
                Edit Bio
              </button>
            ) : (
              <button
                onClick={() => setIsChallengeModalOpen(true)}
                className="bg-cream hover:bg-sand text-bg px-6 py-3 rounded-xl font-space font-bold text-xs uppercase tracking-wider transition cursor-pointer"
              >
                Challenge Duel
              </button>
            )}
          </div>
        </section>

        {/* Stats and Performance Section */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Metrics grid and Radar Chart */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Matches Completed", val: totalMatches },
                { label: "Win Ratio", val: `${winRate}%` },
                { label: "Specialty Mode", val: bestMode === "None" ? "None" : getModeName(bestMode).substring(0, 12) },
                { label: "Current Streak", val: `${player.currentStreak} 🔥` },
              ].map((stat, idx) => (
                <div key={idx} className="bg-surface/40 border border-khaki/10 rounded-xl p-4 flex flex-col justify-center">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-khaki mb-1">{stat.label}</span>
                  <span className="text-xl font-space font-bold text-cream">{stat.val}</span>
                </div>
              ))}
            </div>

            {/* Recharts Radar Performance visualizer */}
            <div className="bg-surface/30 border border-khaki/10 rounded-2xl p-6 backdrop-blur-md">
              <h3 className="font-space text-sm font-bold uppercase tracking-wider text-sand mb-4">Competency Radar Index</h3>
              
              <div className="h-64 md:h-72 w-full flex justify-center items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarStats}>
                    <PolarGrid stroke="#80775C" strokeOpacity={0.2} />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "#FAE8B4", fontSize: 10, fontFamily: "Space Grotesk" }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#80775C" }} />
                    <Radar
                      name={player.username}
                      dataKey="A"
                      stroke="#CBBD93"
                      fill="#574A24"
                      fillOpacity={0.4}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Badges Grid (locked/unlocked) */}
          <div className="lg:col-span-4 bg-surface/30 border border-khaki/10 rounded-2xl p-6 backdrop-blur-md flex flex-col justify-between relative">
            <div>
              <h3 className="font-space text-sm font-bold uppercase tracking-wider text-sand mb-4">Arena Badges</h3>
              
              <div className="grid grid-cols-4 gap-3 relative">
                {badgeList.map((badge) => {
                  const isUnlocked = player.badges.includes(badge.id);

                  return (
                    <div
                      key={badge.id}
                      className="relative flex flex-col items-center justify-center"
                      onMouseEnter={() => setHoveredBadge(badge.id)}
                      onMouseLeave={() => setHoveredBadge(null)}
                    >
                      <div
                        className={`w-14 h-14 rounded-xl border flex items-center justify-center transition-all duration-300 relative ${
                          isUnlocked
                            ? "bg-olive/20 border-sand text-sand shadow-[0_0_15px_rgba(203,189,147,0.15)] hover:scale-105"
                            : "bg-surface border-khaki/10 text-khaki/20"
                        }`}
                      >
                        {badge.icon}
                        
                        {/* Lock Overlay */}
                        {!isUnlocked && (
                          <div className="absolute inset-0 bg-bg/40 backdrop-blur-[0.5px] rounded-xl flex items-center justify-center">
                            <svg className="w-4 h-4 text-khaki/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Tooltip Overlay */}
                      <AnimatePresence>
                        {hoveredBadge === badge.id && (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 5, scale: 0.95 }}
                            className="absolute z-30 bottom-full mb-2 w-48 bg-surface2 border border-khaki/20 p-2.5 rounded-xl text-center shadow-xl backdrop-blur-md pointer-events-none"
                          >
                            <span className="block font-space text-[10px] font-bold text-cream uppercase">{badge.name}</span>
                            <span className="block font-mono text-[9px] text-khaki mt-1 leading-normal">{badge.desc}</span>
                            <span className={`block font-mono text-[8px] mt-1.5 uppercase ${isUnlocked ? "text-sand font-bold" : "text-khaki/40"}`}>
                              {isUnlocked ? "Unlocked" : "Locked"}
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-khaki/10 pt-4 mt-6 text-center">
              <span className="font-mono text-[9px] text-khaki uppercase tracking-wider">
                Earned: {player.badges.length} / {badgeList.length} Badges
              </span>
            </div>
          </div>
        </section>

        {/* Battle History Table */}
        <section className="space-y-4">
          <h3 className="font-space text-lg font-bold uppercase tracking-wider text-sand">Battle History</h3>
          
          <div className="bg-surface/30 border border-khaki/10 rounded-2xl overflow-hidden backdrop-blur-md">
            <div className="grid grid-cols-12 px-6 py-3 border-b border-khaki/10 bg-surface2/25 text-[9px] font-mono uppercase tracking-widest text-khaki">
              <div className="col-span-3">Time Completed</div>
              <div className="col-span-3">Mode</div>
              <div className="col-span-3">Opponent</div>
              <div className="col-span-2">Result</div>
              <div className="col-span-1 text-right">ELO Change</div>
            </div>

            <div className="divide-y divide-khaki/5">
              {battles.length === 0 ? (
                <div className="py-12 text-center text-khaki font-mono text-xs uppercase tracking-wider">
                  NO BATTLE HISTORY REGISTERED.
                </div>
              ) : (
                battles.map((battle) => {
                  const isSolo = !battle.player2;
                  const isWinner = battle.winnerId === player.id;
                  const opponent = isSolo
                    ? null
                    : battle.player1.id === player.id
                    ? battle.player2
                    : battle.player1;

                  return (
                    <div key={battle.id} className="grid grid-cols-12 px-6 py-4 items-center text-xs hover:bg-surface2/15 transition">
                      {/* Time */}
                      <div className="col-span-3 font-mono text-khaki">
                        {getRelativeTime(battle.endedAt)}
                      </div>

                      {/* Mode */}
                      <div className="col-span-3">
                        <span className="font-space font-bold uppercase tracking-wide text-cream">
                          {getModeName(battle.mode)}
                        </span>
                      </div>

                      {/* Opponent */}
                      <div className="col-span-3 flex items-center space-x-2">
                        {isSolo ? (
                          <>
                            <div className="w-5 h-5 rounded bg-surface2 border border-khaki/15 flex items-center justify-center text-[10px]">
                              ⏱️
                            </div>
                            <span className="font-space font-bold text-khaki/50">Solo Clock Run</span>
                          </>
                        ) : (
                          <>
                            <img
                              src={opponent?.avatar}
                              alt={opponent?.username}
                              className="w-5 h-5 rounded border border-khaki/25 object-cover cursor-pointer"
                              onClick={() => router.push(`/profile/${opponent?.username}`)}
                            />
                            <span
                              className="font-space font-bold text-cream hover:text-sand cursor-pointer transition"
                              onClick={() => router.push(`/profile/${opponent?.username}`)}
                            >
                              {opponent?.username}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Result */}
                      <div className="col-span-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-space font-bold border uppercase ${
                            isWinner
                              ? "bg-[#81c784]/10 text-[#81c784] border-[#81c784]/30"
                              : "bg-[#e57373]/10 text-[#e57373] border-[#e57373]/30"
                          }`}
                        >
                          {isWinner ? "Win" : "Loss"}
                        </span>
                      </div>

                      {/* ELO Delta */}
                      <div className={`col-span-1 text-right font-mono font-bold ${isWinner ? "text-[#81c784]" : "text-[#e57373]"}`}>
                        {isWinner ? "+30" : "-20"}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

      </main>

      {/* EDIT BIO POPUP DIALOG */}
      <Dialog.Root open={isEditBioOpen} onOpenChange={setIsEditBioOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-surface border border-khaki/20 p-8 rounded-2xl w-full max-w-md z-50 shadow-2xl overflow-hidden font-sans flex flex-col max-h-[85vh]">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sand to-transparent opacity-60 flex-shrink-0" />
            
            <Dialog.Title className="font-space text-xl font-bold text-cream mb-4 uppercase flex-shrink-0">
              EDIT PROFILE BIO
            </Dialog.Title>

            <form onSubmit={handleSaveBio} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 min-h-0 pb-4">
                <div className="space-y-2">
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-khaki">System Summary</label>
                  <textarea
                    value={bioInput}
                    onChange={(e) => setBioInput(e.target.value)}
                    placeholder="Summarize your hardware core specs, software stacks, or combat style..."
                    rows={4}
                    maxLength={200}
                    className="w-full bg-bg border border-khaki/20 text-cream p-3 rounded-lg text-xs focus:outline-none focus:border-sand leading-relaxed"
                  />
                  <div className="text-right text-[9px] text-khaki font-mono">
                    {bioInput.length} / 200 characters
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-khaki/10 mt-auto bg-surface flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditBioOpen(false)}
                  className="w-1/2 border border-khaki/20 hover:border-khaki/50 py-3 rounded-xl font-space font-semibold text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingBio}
                  className="w-1/2 bg-cream text-bg py-3 rounded-xl font-space font-semibold text-xs uppercase tracking-wider hover:bg-sand transition cursor-pointer"
                >
                  {isSavingBio ? "Saving..." : "Save Bio"}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* CHALLENGE BATTLE POPUP DIALOG */}
      <Dialog.Root open={isChallengeModalOpen} onOpenChange={setIsChallengeModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-surface border border-khaki/20 p-8 rounded-2xl w-full max-w-sm z-50 shadow-2xl overflow-hidden font-sans flex flex-col max-h-[85vh]">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sand to-transparent opacity-60 flex-shrink-0" />

            <Dialog.Title className="font-space text-xl font-bold text-cream mb-4 uppercase flex-shrink-0">
              CHALLENGE TO DUEL
            </Dialog.Title>

            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 min-h-0 pb-4">
                <Dialog.Description className="text-xs text-khaki font-mono">
                  Establish a direct duel link with @{player.username}. Select the arena mode to launch:
                </Dialog.Description>

                <div className="space-y-4">
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-khaki">Battle Mode</label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: "SYSTEM_CRASH", label: "System Crash" },
                      { id: "ARCH_WARS", label: "Arch Wars" },
                      { id: "LOAD_BREAKER", label: "Load Breaker" },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => setChallengeMode(mode.id)}
                        className={`py-3 px-4 text-xs font-space font-bold uppercase rounded-lg border text-left tracking-wider transition ${
                          challengeMode === mode.id
                            ? "bg-cream text-bg border-cream"
                            : "border-khaki/20 hover:border-khaki/50 text-cream"
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-khaki/10 mt-auto bg-surface flex-shrink-0">
                <button
                  onClick={() => setIsChallengeModalOpen(false)}
                  className="w-1/2 border border-khaki/20 hover:border-khaki/50 py-3 rounded-xl font-space font-semibold text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLaunchChallenge}
                  className="w-1/2 bg-cream text-bg py-3 rounded-xl font-space font-semibold text-xs uppercase tracking-wider hover:bg-sand transition cursor-pointer"
                >
                  Send Invite
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

    </div>
  );
}
