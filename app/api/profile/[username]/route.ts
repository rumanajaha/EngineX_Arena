import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BattleMode, BattleStatus } from "@/app/generated/prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { username: string } }
) {
  const { username } = params;

  try {
    const player = await prisma.player.findFirst({
      where: {
        username: {
          equals: username,
          mode: "insensitive",
        },
      },
    });

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // Fetch last 20 completed battles involving this player
    const battles = await prisma.battle.findMany({
      where: {
        status: BattleStatus.COMPLETED,
        OR: [
          { player1Id: player.id },
          { player2Id: player.id },
        ],
      },
      include: {
        player1: {
          select: {
            id: true,
            username: true,
            avatar: true,
            eloRating: true,
          },
        },
        player2: {
          select: {
            id: true,
            username: true,
            avatar: true,
            eloRating: true,
          },
        },
        winner: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        endedAt: "desc",
      },
      take: 20,
    });

    // Fetch submissions to calculate speeds and other metrics
    const submissions = await prisma.battleSubmission.findMany({
      where: {
        playerId: player.id,
      },
    });

    // Count wins per mode
    const wins = battles.filter((b) => b.winnerId === player.id);
    const winsCrash = wins.filter((b) => b.mode === BattleMode.SYSTEM_CRASH).length;
    const winsArch = wins.filter((b) => b.mode === BattleMode.ARCH_WARS).length;
    const winsLoad = wins.filter((b) => b.mode === BattleMode.LOAD_BREAKER).length;

    const totalCrash = battles.filter((b) => b.mode === BattleMode.SYSTEM_CRASH).length;
    const totalArch = battles.filter((b) => b.mode === BattleMode.ARCH_WARS).length;
    const totalLoad = battles.filter((b) => b.mode === BattleMode.LOAD_BREAKER).length;

    // 1. Debugging score (SYSTEM_CRASH success rate)
    const debuggingScore = totalCrash > 0 ? Math.round((winsCrash / totalCrash) * 80 + 20) : 50;

    // 2. Architecture score (ARCH_WARS success rate)
    const architectureScore = totalArch > 0 ? Math.round((winsArch / totalArch) * 80 + 20) : 50;

    // 3. Optimization score (LOAD_BREAKER success rate)
    const optimizationScore = totalLoad > 0 ? Math.round((winsLoad / totalLoad) * 80 + 20) : 50;

    // 4. Speed score (avg submission time taken in seconds)
    const validTimes = submissions
      .map((s) => s.timeTakenMs)
      .filter((t): t is number => typeof t === "number" && t > 0);
    const avgTimeMs = validTimes.length > 0 ? validTimes.reduce((a, b) => a + b, 0) / validTimes.length : 120000;
    
    // Formula: 100 - avg seconds taken / 2. Placed in bounds [20, 100]
    const speedScore = Math.max(20, Math.min(100, Math.round(100 - (avgTimeMs / 2000))));

    // 5. Consistency score (based on win rate and current streak)
    const totalMatches = player.totalWins + player.totalLosses;
    const winRate = totalMatches > 0 ? (player.totalWins / totalMatches) * 100 : 0;
    const consistencyScore = Math.max(20, Math.min(100, Math.round(winRate * 0.8 + player.currentStreak * 5)));

    const radarStats = [
      { subject: "Debugging", A: debuggingScore, fullMark: 100 },
      { subject: "Architecture", A: architectureScore, fullMark: 100 },
      { subject: "Optimization", A: optimizationScore, fullMark: 100 },
      { subject: "Speed", A: speedScore, fullMark: 100 },
      { subject: "Consistency", A: consistencyScore, fullMark: 100 },
    ];

    // Compute best mode
    const modeWins = { SYSTEM_CRASH: winsCrash, ARCH_WARS: winsArch, LOAD_BREAKER: winsLoad };
    let bestMode = "None";
    let maxWins = 0;
    Object.entries(modeWins).forEach(([mode, count]) => {
      if (count > maxWins) {
        maxWins = count;
        bestMode = mode;
      }
    });

    // Check badges conditions
    const newBadges: string[] = [];
    if (player.totalWins >= 1) newBadges.push("First Blood");
    if (player.currentStreak >= 3) newBadges.push("Hat Trick");
    if (player.currentStreak >= 10) newBadges.push("Unbreakable");
    if (winsArch >= 10) newBadges.push("Architect");
    if (winsCrash >= 10) newBadges.push("Exterminator");
    
    // Speedrun badge: won LoadBreaker in under 60 seconds
    const hasSpeedrun = wins.some((b) => {
      if (b.mode !== BattleMode.LOAD_BREAKER) return false;
      const playerSub = submissions.find((s) => s.battleId === b.id && s.timeTakenMs && s.timeTakenMs <= 60000);
      return !!playerSub;
    });
    if (hasSpeedrun) newBadges.push("Speedrun");
    if (totalMatches >= 100) newBadges.push("Centurion");
    if (player.eloRating >= 1600) newBadges.push("Elite");

    // Sync badges with database if changed
    if (JSON.stringify(newBadges.sort()) !== JSON.stringify(player.badges.sort())) {
      await prisma.player.update({
        where: { id: player.id },
        data: {
          badges: newBadges,
        },
      });
      player.badges = newBadges;
    }

    return NextResponse.json({
      player,
      battles,
      radarStats,
      bestMode,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { username: string } }
) {
  const { username } = params;

  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.player) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentP = session.player;
    if (currentP.username.toLowerCase() !== username.toLowerCase()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { bio } = await request.json();

    const updatedPlayer = await prisma.player.update({
      where: { id: currentP.id },
      data: {
        bio: bio ?? "",
      },
    });

    return NextResponse.json({ success: true, player: updatedPlayer });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
