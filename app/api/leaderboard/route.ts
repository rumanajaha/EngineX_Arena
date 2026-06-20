import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const myPlayer = session?.player;

    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab") || "global"; // global, weekly, SYSTEM_CRASH, ARCH_WARS, LOAD_BREAKER

    // Fetch all players to calculate ranks and top modes accurately
    const allPlayers = await prisma.player.findMany({
      include: {
        wonBattles: {
          select: {
            mode: true,
          },
        },
      },
    });

    // Helper to calculate top mode
    const getTopMode = (wonBattles: { mode: string }[]) => {
      if (wonBattles.length === 0) return "None";
      const counts: Record<string, number> = {};
      wonBattles.forEach((b) => {
        counts[b.mode] = (counts[b.mode] || 0) + 1;
      });
      let topMode = "None";
      let maxCount = 0;
      Object.entries(counts).forEach(([mode, count]) => {
        if (count > maxCount) {
          maxCount = count;
          topMode = mode;
        }
      });
      return topMode;
    };

    // Map players to include calculated fields
    const playersWithStats = allPlayers.map((p) => {
      const totalMatches = p.totalWins + p.totalLosses;
      const winRate = totalMatches > 0 ? (p.totalWins / totalMatches) * 100 : 0;
      return {
        id: p.id,
        username: p.username,
        avatar: p.avatar,
        githubUrl: p.githubUrl,
        eloRating: p.eloRating,
        totalWins: p.totalWins,
        totalLosses: p.totalLosses,
        weeklyWins: p.weeklyWins,
        currentStreak: p.currentStreak,
        topMode: getTopMode(p.wonBattles),
        winRate,
        wonBattlesCount: p.wonBattles.length,
        // Helper count specifically for the requested mode if tab matches a mode
        modeWinsCount: p.wonBattles.filter((b) => b.mode === tab).length,
      };
    });

    // Sort players depending on tab
    if (tab === "global") {
      playersWithStats.sort((a, b) => b.eloRating - a.eloRating || b.totalWins - a.totalWins);
    } else if (tab === "weekly") {
      playersWithStats.sort((a, b) => b.weeklyWins - a.weeklyWins || b.eloRating - a.eloRating);
    } else {
      // Tab is one of BattleMode keys (SYSTEM_CRASH, ARCH_WARS, LOAD_BREAKER)
      playersWithStats.sort((a, b) => b.modeWinsCount - a.modeWinsCount || b.eloRating - a.eloRating);
    }

    // Assign rank to all players
    const rankedPlayers = playersWithStats.map((p, idx) => ({
      ...p,
      rank: idx + 1,
    }));

    // Slice top 100
    const top100 = rankedPlayers.slice(0, 100);

    // Find current user's entry if logged in
    let currentUserRow = null;
    if (myPlayer) {
      const myRow = rankedPlayers.find((p) => p.id === myPlayer.id);
      if (myRow) {
        currentUserRow = myRow;
      }
    }

    return NextResponse.json({
      leaderboard: top100,
      currentUser: currentUserRow,
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
