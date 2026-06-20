"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/providers/ToastProvider";
import IntroAnimation from "@/components/IntroAnimation";

interface Player {
  id: string;
  username: string;
  avatar: string;
  eloRating: number;
}

interface Battle {
  id: string;
  roomId: string;
  mode: string;
  status: string;
  player1: Player;
  player2: Player | null;
  winnerId: string | null;
  winner: { id: string; username: string } | null;
  endedAt: string;
}

interface Challenge {
  id: string;
  mode: string;
  title: string;
  description: string;
  difficulty: string;
}

interface ActivityEvent {
  id: string;
  message: string;
  mode: string;
  winner: { id: string; username: string; avatar: string };
  loser: { id: string; username: string; avatar: string };
  timestamp: string;
}

interface FriendChallengeInvite {
  challenger: {
    id: string;
    username: string;
    avatar: string;
    eloRating: number;
  };
  mode: string;
  roomId: string;
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

const fallbackChallenge: Challenge = {
  id: "fallback-daily",
  mode: "SYSTEM_CRASH",
  title: "Memory Leak: Array Sum Overflow",
  description: "Analyze the code to find the index-out-of-bounds issue. The function is supposed to sum all integers in an array but accesses an uninitialized element.",
  difficulty: "EASY",
};

interface PlayerStats {
  id: string;
  username: string;
  avatar: string;
  eloRating: number;
  totalWins: number;
  totalLosses: number;
  currentStreak: number;
  badges: string[];
}

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 2500) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

export default function HubPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const me = session?.player;
  const { showToast } = useToast();

  // Socket
  const socketRef = useRef<Socket | null>(null);

  // States
  const [recentBattles, setRecentBattles] = useState<Battle[]>([]);
  const [dailyChallenge, setDailyChallenge] = useState<Challenge | null>(null);
  const [dailyChallengeSolvedCount, setDailyChallengeSolvedCount] = useState(0);
  const [friends, setFriends] = useState<Player[]>([]);
  const [onlinePlayerIds, setOnlinePlayerIds] = useState<string[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const friendsRef = useRef<Player[]>([]);
  const onlinePlayerIdsRef = useRef<string[]>([]);

  useEffect(() => {
    friendsRef.current = friends;
  }, [friends]);



  // Incoming challenge notification toast
  const [activeInvite, setActiveInvite] = useState<FriendChallengeInvite | null>(null);

  const activitiesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll logic for activities ticker
  useEffect(() => {
    if (activitiesEndRef.current) {
      activitiesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activities]);

  // Fetch initial data
  useEffect(() => {
    if (status === "loading") return;
    if (!me) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);

      // 1. Fetch Latest Stats from DB
      try {
        const statsRes = await fetchWithTimeout("/api/hub/stats");
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setPlayerStats(statsData);
        }
      } catch (error) {
        console.error("Error loading hub stats:", error);
      }

      // 2. Recent battles
      try {
        const battlesRes = await fetchWithTimeout("/api/battles/recent");
        if (battlesRes.ok) {
          const battlesData = await battlesRes.json();
          setRecentBattles(battlesData);
        } else {
          setRecentBattles([]);
        }
      } catch (error) {
        console.error("Error loading recent battles:", error);
        setRecentBattles([]);
      }

      // 3. Daily Challenge
      try {
        const dailyRes = await fetchWithTimeout("/api/challenges/daily");
        if (dailyRes.ok) {
          const dailyData = await dailyRes.json();
          setDailyChallenge(dailyData.challenge);
          setDailyChallengeSolvedCount(dailyData.solvedCount);
        } else {
          setDailyChallenge(null);
        }
      } catch (error) {
        console.error("Error loading daily challenge:", error);
        setDailyChallenge(null);
      }

      // 4. Friends
      try {
        const friendsRes = await fetchWithTimeout("/api/friends/list").catch(() => fetchWithTimeout("/api/friends"));
        if (friendsRes.ok) {
          const friendsData = await friendsRes.json();
          setFriends(friendsData);
        } else {
          setFriends([]);
        }
      } catch (error) {
        console.error("Error loading friends:", error);
        setFriends([]);
      }

      setIsLoading(false);
    };

    fetchData();
  }, [me, status]);

  // Handle Socket listeners
  useEffect(() => {
    if (!me) return;

    const socket = io("http://localhost:3001");
    socketRef.current = socket;

    socket.emit("join:lobby", me.id);

    // Online players list updates
    socket.on("lobby:players_update", (data: { count: number; onlinePlayerIds?: string[] }) => {
      if (data.onlinePlayerIds) {
        const nextIds = data.onlinePlayerIds;
        const prevIds = onlinePlayerIdsRef.current;
        friendsRef.current.forEach((friend) => {
          if (nextIds.includes(friend.id) && !prevIds.includes(friend.id)) {
            showToast(
              "Friend Online",
              `@${friend.username} is now online in the arena.`,
              "success"
            );
          }
        });
        onlinePlayerIdsRef.current = nextIds;
        setOnlinePlayerIds(nextIds);
      }
    });

    // Real-time ticker
    socket.on("hub:activity", (event: ActivityEvent) => {
      setActivities((prev) => {
        const next = [event, ...prev];
        return next.slice(0, 20); // Keep last 20
      });
    });

    // Incoming friend challenge
    socket.on("friend:challenge_received", (invite: FriendChallengeInvite) => {
      setActiveInvite(invite);
      showToast(
        "Challenge Received!",
        `@${invite.challenger.username} challenged you to ${getModeName(invite.mode)}.`,
        "info"
      );
      // Auto dismiss after 15 seconds
      setTimeout(() => {
        setActiveInvite((curr) => (curr?.roomId === invite.roomId ? null : curr));
      }, 15000);
    });

    // Handle game room ready (matching, friend accept, etc.)
    socket.on("room:ready", (data: { battleId: string; roomId: string; redirectUrl: string }) => {
      router.push(`/battle/${data.roomId}`);
    });

    return () => {
      socket.disconnect();
    };
  }, [me, router, showToast]);



  // Accept incoming challenge
  const handleAcceptChallenge = () => {
    if (!me || !activeInvite || !socketRef.current) return;

    socketRef.current.emit("join:room", {
      playerId: me.id,
      roomId: activeInvite.roomId,
    });
    setActiveInvite(null);
  };

  // Daily challenge Play button
  const handlePlayDailyChallenge = () => {
    const activeChallenge = dailyChallenge || fallbackChallenge;
    if (activeChallenge) {
      router.push(`/solo/${activeChallenge.id}`);
    }
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
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-olive/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-sand/5 blur-[150px] rounded-full pointer-events-none" />

        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 space-y-8 relative z-10 animate-pulse">
          {/* SKELETON HEADER */}
          <div className="bg-surface/50 border border-khaki/10 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
              <div className="flex items-center space-x-5">
                <div className="w-20 h-20 rounded-2xl bg-surface2/60 border border-khaki/20" />
                <div className="space-y-2">
                  <div className="h-8 w-48 bg-khaki/20 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-khaki/10 rounded animate-pulse" />
                </div>
              </div>
              <div className="w-40 h-10 bg-khaki/15 rounded-xl hidden lg:block" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-surface/30 border border-khaki/10 rounded-xl p-4 h-20" />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* SKELETON DAILY CHALLENGE */}
              <div className="bg-gradient-to-r from-surface2 to-olive/10 border border-sand/15 rounded-2xl p-6 h-36" />
              {/* SKELETON CARDS */}
              <div className="space-y-4">
                <div className="h-6 w-32 bg-khaki/20 rounded" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-surface border border-khaki/10 rounded-xl p-5 h-56 flex flex-col justify-between" />
                  ))}
                </div>
              </div>
              {/* SKELETON TICKER */}
              <div className="space-y-4">
                <div className="h-6 w-48 bg-khaki/20 rounded" />
                <div className="bg-surface/50 border border-khaki/10 rounded-2xl h-72" />
              </div>
            </div>

            <div className="space-y-8">
              {/* SKELETON RECENT BATTLES */}
              <div className="space-y-4">
                <div className="h-6 w-36 bg-khaki/20 rounded" />
                <div className="bg-surface/50 border border-khaki/10 rounded-2xl p-4 h-64" />
              </div>
              {/* SKELETON FRIENDS */}
              <div className="space-y-4">
                <div className="h-6 w-28 bg-khaki/20 rounded" />
                <div className="bg-surface/50 border border-khaki/10 rounded-2xl p-4 h-64" />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const activeStats = playerStats || me;
  if (!activeStats) return null;

  const badge = getEloBadge(activeStats.eloRating);
  const totalBattles = activeStats.totalWins + activeStats.totalLosses;
  const winRate = totalBattles > 0 ? Math.round((activeStats.totalWins / totalBattles) * 100) : 0;

  return (
    <IntroAnimation>
      <div className="h-full w-full bg-bg text-cream flex flex-col font-sans overflow-y-auto relative">
        {/* Sci-Fi Decorative Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(128,119,92,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(128,119,92,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-olive/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-sand/5 blur-[150px] rounded-full pointer-events-none" />

        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 space-y-8 relative z-10">
        {/* SECTION 1: War Room Header */}
        <section className="bg-surface/50 border border-khaki/10 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden">
          {/* Subtle top light bar */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-sand/30 to-transparent" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <div className="flex items-center space-x-5">
              <div className="relative">
                <img
                  src={activeStats.avatar}
                  alt={activeStats.username}
                  className="w-20 h-20 rounded-2xl border-2 border-khaki/20 bg-surface2/60 shadow-lg object-cover"
                />
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sand opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-sand"></span>
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-baseline space-x-3">
                  <h2 className="font-space text-3xl font-bold tracking-tight text-cream">{activeStats.username}</h2>
                  <span className="font-mono text-xs text-khaki uppercase tracking-widest">Active Player</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-0.5 border text-xs font-mono font-bold rounded uppercase tracking-wider ${badge.color}`}>
                    {badge.name} Division
                  </span>
                  <span className="font-mono text-sm text-sand">Rating: {activeStats.eloRating} ELO</span>
                </div>
              </div>
            </div>

            {/* Division Badge Illustration Icon */}
            <div className="hidden lg:flex items-center space-x-2 bg-bg/50 border border-khaki/10 px-4 py-2 rounded-xl">
              <svg className="w-6 h-6 text-sand animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="font-space text-xs font-bold uppercase tracking-wider text-khaki">EngineX Certified</span>
            </div>
          </div>

          {/* Metric grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Wins", val: activeStats.totalWins, color: "text-[#81c784]" },
              { label: "Losses", val: activeStats.totalLosses, color: "text-[#e57373]" },
              { label: "Total Matches", val: totalBattles, color: "text-cream" },
              { label: "Win Rate", val: `${winRate}%`, color: "text-sand" },
              { label: "Streak", val: `${activeStats.currentStreak} 🔥`, color: "text-amber-500" },
            ].map((stat, idx) => (
              <div key={idx} className="bg-bg/40 border border-khaki/10 rounded-xl p-4 flex flex-col justify-center">
                <span className="text-[10px] uppercase font-mono tracking-widest text-khaki mb-1">{stat.label}</span>
                <span className={`text-2xl font-space font-bold ${stat.color}`}>{stat.val}</span>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 2: 2-Column Dashboard Body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT & CENTER: Feed, Challenge & Modes (2 Columns space) */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Daily Challenge Banner */}
            {(() => {
              const challengeToShow = dailyChallenge || fallbackChallenge;
              return challengeToShow ? (
                <section className="relative bg-gradient-to-r from-surface2 to-olive/20 border border-sand/20 rounded-2xl p-6 overflow-hidden shadow-xl group">
                  {/* Decorative pulsing neon edge */}
                  <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-sand/5 to-transparent pointer-events-none" />

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div className="space-y-3 max-w-lg">
                      <div className="flex items-center space-x-2">
                        <span className="bg-sand text-bg px-2.5 py-0.5 rounded text-[10px] font-space font-bold uppercase tracking-wider">
                          Daily Challenge
                        </span>
                        <span className="font-mono text-xs text-khaki uppercase tracking-wider">
                          {dailyChallengeSolvedCount} solves today
                        </span>
                      </div>
                      <h3 className="font-space text-2xl font-bold text-cream tracking-tight group-hover:text-sand transition-colors">
                        {challengeToShow.title}
                      </h3>
                      <p className="text-xs text-khaki leading-relaxed">{challengeToShow.description}</p>
                    </div>

                    <button
                      onClick={handlePlayDailyChallenge}
                      className="flex-shrink-0 bg-cream hover:bg-sand text-bg font-space font-bold text-xs uppercase px-6 py-3.5 rounded-xl tracking-wider shadow-lg transition duration-200 cursor-pointer flex items-center space-x-2"
                    >
                      <span>Play Solo Run</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </button>
                  </div>
                </section>
              ) : null;
            })()}

            {/* Quick Play Buttons (3 Mode Cards) */}
            <section className="space-y-4">
              <h3 className="font-space text-lg font-bold uppercase tracking-wider text-sand">Battle Modes</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    mode: "SYSTEM_CRASH",
                    title: "System Crash",
                    desc: "Resolve buffer overflows and execution faults under standard Monaco debug terminal environments.",
                    bg: "from-surface to-[#574A24]/10",
                    border: "border-sand/15",
                    icon: (
                      <svg className="w-8 h-8 text-sand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    ),
                  },
                  {
                    mode: "ARCH_WARS",
                    title: "Arch Wars",
                    desc: "Arrange network nodes, queue adapters, and caching routers on an interactive React Flow logic canvas.",
                    bg: "from-surface to-[#80775C]/10",
                    border: "border-khaki/15",
                    icon: (
                      <svg className="w-8 h-8 text-khaki" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    ),
                  },
                  {
                    mode: "LOAD_BREAKER",
                    title: "Load Breaker",
                    desc: "Debug and refactor slow database loops, optimizing throughput variables to process peak execution traffic.",
                    bg: "from-surface to-surface2",
                    border: "border-olive/20",
                    icon: (
                      <svg className="w-8 h-8 text-cream" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    ),
                  },
                ].map((card) => (
                  <div
                    key={card.mode}
                    className={`bg-gradient-to-br ${card.bg} border ${card.border} rounded-xl p-5 flex flex-col justify-between hover:border-sand/40 transition-all duration-300 group`}
                  >
                    <div className="space-y-4">
                      <div className="p-3 bg-bg/50 border border-khaki/10 w-fit rounded-lg shadow-inner">
                        {card.icon}
                      </div>
                      <div>
                        <h4 className="font-space text-lg font-bold text-cream group-hover:text-sand transition-colors">
                          {card.title}
                        </h4>
                        <p className="text-[11px] text-khaki mt-1 leading-relaxed">{card.desc}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => router.push(`/lobby?mode=${card.mode}`)}
                      className="mt-6 w-full bg-surface2 hover:bg-cream hover:text-bg text-cream font-space font-bold text-xs uppercase py-2.5 rounded-lg border border-khaki/20 tracking-wider transition cursor-pointer"
                    >
                      Enter Battle
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Live Activity Feed */}
            <section className="space-y-4">
              <h3 className="font-space text-lg font-bold uppercase tracking-wider text-sand">Live Activity Ticker</h3>
              <div className="bg-surface/50 border border-khaki/10 rounded-2xl overflow-hidden flex flex-col">
                <div className="p-4 border-b border-khaki/10 bg-surface2/30 flex items-center justify-between text-xs font-mono">
                  <span className="text-khaki uppercase tracking-widest">Global Battle Activity Feed</span>
                  <span className="flex items-center space-x-1.5 text-sand">
                    <span className="w-1.5 h-1.5 rounded-full bg-sand animate-ping" />
                    <span>Listening on port 3001</span>
                  </span>
                </div>

                <div className="h-60 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-surface2">
                  {activities.length === 0 ? (
                    <div className="h-full flex flex-col justify-center items-center text-center text-khaki font-mono text-xs">
                      <svg className="w-8 h-8 text-khaki/20 mb-2 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Arena is quiet... be the first to battle
                    </div>
                  ) : (
                    activities.map((act) => (
                      <div
                        key={act.id}
                        className="bg-bg/40 border border-khaki/5 hover:border-khaki/20 p-3 rounded-xl flex items-center justify-between text-xs transition"
                      >
                        <div className="flex items-center space-x-3">
                          {/* Mode icon indicator */}
                          <div className="w-6 h-6 rounded bg-surface border border-khaki/15 flex items-center justify-center flex-shrink-0 text-[10px] font-mono text-sand">
                            {act.mode === "SYSTEM_CRASH" ? "SC" : act.mode === "ARCH_WARS" ? "AW" : "LB"}
                          </div>

                          {/* Avatars */}
                          <div className="flex items-center -space-x-1.5 flex-shrink-0">
                            <img src={act.winner.avatar} alt={act.winner.username} className="w-5 h-5 rounded border border-khaki/20 object-cover" />
                            <img src={act.loser.avatar} alt={act.loser.username} className="w-5 h-5 rounded border border-khaki/20 object-cover opacity-70" />
                          </div>

                          {/* Message */}
                          <span className="font-sans text-cream/90 font-medium">
                            {act.message.split(" ").map((word, i) => {
                              if (word.startsWith("@")) {
                                return <span key={i} className="text-sand font-semibold mr-1">{word}</span>;
                              }
                              return <span key={i} className="mr-1">{word}</span>;
                            })}
                          </span>
                        </div>

                        {/* Timestamp */}
                        <span className="font-mono text-[9px] text-khaki flex-shrink-0">
                          {getRelativeTime(act.timestamp)}
                        </span>
                      </div>
                    ))
                  )}
                  <div ref={activitiesEndRef} />
                </div>
              </div>
            </section>

          </div>

          {/* RIGHT COLUMN: Recent Battles & Friends list */}
          <div className="space-y-8">
            
            {/* Recent Battles */}
            <section className="space-y-4">
              <h3 className="font-space text-lg font-bold uppercase tracking-wider text-sand">Recent Battles</h3>
              <div className="bg-surface/50 border border-khaki/10 rounded-2xl p-4 backdrop-blur-md space-y-3">
                {recentBattles.length === 0 ? (
                  <div className="py-8 text-center text-khaki font-mono text-xs">
                    No battles yet — Enter the lobby to fight
                  </div>
                ) : (
                  recentBattles.map((battle) => {
                    const isSolo = !battle.player2;
                    const isMeWinner = battle.winnerId === activeStats.id;
                    const opponent = isSolo
                      ? null
                      : battle.player1.id === activeStats.id
                      ? battle.player2
                      : battle.player1;

                    return (
                      <div
                        key={battle.id}
                        className="bg-bg/30 border border-khaki/10 rounded-xl p-3 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center space-x-3">
                          {isSolo ? (
                            <div className="w-8 h-8 rounded-lg bg-surface2 border border-khaki/25 flex items-center justify-center text-khaki text-base">
                              ⏱️
                            </div>
                          ) : (
                            <img
                              src={opponent?.avatar}
                              alt={opponent?.username}
                              className="w-8 h-8 rounded-lg border border-khaki/20 bg-surface2/60 object-cover"
                            />
                          )}

                          <div className="space-y-0.5">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-space font-bold text-cream">
                                {isSolo ? "Solo Run" : opponent?.username}
                              </span>
                              <span className="font-mono text-[9px] text-khaki uppercase bg-surface2 border border-khaki/10 px-1.5 py-0.25 rounded">
                                {getModeName(battle.mode).substring(0, 10)}
                              </span>
                            </div>
                            <span className="font-mono text-[9px] text-khaki">
                              {getRelativeTime(battle.endedAt)}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-space font-bold border uppercase ${
                              isMeWinner
                                ? "bg-[#81c784]/10 text-[#81c784] border-[#81c784]/30"
                                : "bg-[#e57373]/10 text-[#e57373] border-[#e57373]/30"
                            }`}
                          >
                            {isMeWinner ? "Win" : "Loss"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* Friends list */}
            <section className="space-y-4">
              <h3 className="font-space text-lg font-bold uppercase tracking-wider text-sand">Friends list</h3>
              <div className="bg-surface/50 border border-khaki/10 rounded-2xl p-4 backdrop-blur-md space-y-4">
                {friends.length === 0 ? (
                  <div className="py-8 text-center text-khaki font-mono text-xs">
                    No friends yet — search for players to add them
                  </div>
                ) : (
                  friends.map((friend) => {
                    const isOnline = onlinePlayerIds.includes(friend.id);
                    const friendBadge = getEloBadge(friend.eloRating);

                    return (
                      <div key={friend.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <img
                              src={friend.avatar}
                              alt={friend.username}
                              className="w-9 h-9 rounded-lg border border-khaki/20 object-cover"
                            />
                            {/* Online / Offline status dot */}
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg ${
                                isOnline ? "bg-sand animate-pulse" : "bg-zinc-600"
                              }`}
                            />
                          </div>

                          <div className="space-y-0.5">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-space font-bold text-cream">{friend.username}</span>
                              <span className="font-mono text-[8px] text-khaki">ELO: {friend.eloRating}</span>
                            </div>
                            <span className={`text-[8px] font-mono border px-1 rounded uppercase ${friendBadge.color}`}>
                              {friendBadge.name}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => router.push(`/lobby?challengeFriendId=${friend.id}&friendName=${friend.username}`)}
                          disabled={!isOnline}
                          className={`font-space font-bold uppercase tracking-wider text-[10px] px-3 py-1.5 rounded-lg border transition ${
                            isOnline
                              ? "bg-cream border-cream hover:bg-sand text-bg cursor-pointer"
                              : "border-khaki/15 text-khaki/40 cursor-not-allowed"
                          }`}
                        >
                          Challenge
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

          </div>
        </div>
      </main>

      {/* INCOMING FRIEND CHALLENGE TOAST NOTIFICATION */}
      <AnimatePresence>
        {activeInvite && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 max-w-sm w-full bg-surface2/95 border-2 border-sand rounded-2xl p-5 shadow-[0_10px_35px_rgba(203,189,147,0.3)] backdrop-blur-md z-50 font-sans"
          >
            <div className="flex items-start space-x-4">
              <img
                src={activeInvite.challenger.avatar}
                alt={activeInvite.challenger.username}
                className="w-12 h-12 rounded-xl border border-khaki/20 object-cover flex-shrink-0"
              />
              <div className="flex-1 space-y-2">
                <div>
                  <h4 className="font-space font-bold text-sm text-cream">
                    @{activeInvite.challenger.username} challenged you!
                  </h4>
                  <p className="text-[10px] text-khaki font-mono uppercase mt-0.5">
                    Mode: {getModeName(activeInvite.mode)}
                  </p>
                </div>

                <div className="flex space-x-2 pt-1">
                  <button
                    onClick={() => setActiveInvite(null)}
                    className="w-1/2 border border-khaki/20 hover:border-khaki/50 py-2 rounded-lg font-space font-semibold text-[10px] uppercase tracking-wider transition cursor-pointer"
                  >
                    Decline
                  </button>
                  <button
                    onClick={handleAcceptChallenge}
                    className="w-1/2 bg-cream text-bg py-2 rounded-lg font-space font-semibold text-[10px] uppercase tracking-wider hover:bg-sand transition cursor-pointer"
                  >
                    Accept
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </IntroAnimation>
  );
}
