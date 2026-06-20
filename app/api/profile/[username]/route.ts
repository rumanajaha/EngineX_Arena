import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BattleMode } from "@prisma/client";

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

    // Fetch last 20 BattleSubmissions for this player joined with Battle and opponent Player data
    const submissions = await prisma.battleSubmission.findMany({
      where: {
        playerId: player.id,
      },
      include: {
        battle: {
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
          },
        },
      },
      orderBy: {
        submittedAt: "desc",
      },
      take: 20,
    });

    // To calculate streak and win stats, fetch all completed battles involving this player
    const allCompletedBattles = await prisma.battle.findMany({
      where: {
        status: "COMPLETED",
        OR: [
          { player1Id: player.id },
          { player2Id: player.id },
        ],
      },
      orderBy: {
        endedAt: "asc",
      },
    });

    // Calculate longest streak
    let currentWinStreak = 0;
    let longestStreak = 0;
    allCompletedBattles.forEach((battle) => {
      if (battle.winnerId === player.id) {
        currentWinStreak++;
        if (currentWinStreak > longestStreak) {
          longestStreak = currentWinStreak;
        }
      } else {
        currentWinStreak = 0;
      }
    });

    // Calculate win rates per mode for radar and best mode
    const totalBattles = player.totalWins + player.totalLosses;
    const winRate = totalBattles > 0 ? Math.round((player.totalWins / totalBattles) * 100) : 0;

    const crashBattles = allCompletedBattles.filter(b => b.mode === BattleMode.SYSTEM_CRASH);
    const archBattles = allCompletedBattles.filter(b => b.mode === BattleMode.ARCH_WARS);
    const loadBattles = allCompletedBattles.filter(b => b.mode === BattleMode.LOAD_BREAKER);

    const winsCrash = crashBattles.filter(b => b.winnerId === player.id).length;
    const winsArch = archBattles.filter(b => b.winnerId === player.id).length;
    const winsLoad = loadBattles.filter(b => b.winnerId === player.id).length;

    // Calculate best mode
    const modeWins = { SYSTEM_CRASH: winsCrash, ARCH_WARS: winsArch, LOAD_BREAKER: winsLoad };
    let bestMode = "None";
    let maxWins = 0;
    Object.entries(modeWins).forEach(([mode, count]) => {
      if (count > maxWins) {
        maxWins = count;
        bestMode = mode;
      }
    });

    // Radar chart calculations:
    // Debugging, Architecture, Optimization, Speed, Consistency.
    const debuggingScore = crashBattles.length > 0 ? Math.round((winsCrash / crashBattles.length) * 80 + 20) : 0;
    const architectureScore = archBattles.length > 0 ? Math.round((winsArch / archBattles.length) * 80 + 20) : 0;
    const optimizationScore = loadBattles.length > 0 ? Math.round((winsLoad / loadBattles.length) * 80 + 20) : 0;

    // Speed Score
    const timeTakens = submissions
      .map(s => s.timeTakenMs)
      .filter((t): t is number => typeof t === "number" && t > 0);
    const avgTimeMs = timeTakens.length > 0 ? timeTakens.reduce((sum, current) => sum + current, 0) / timeTakens.length : 0;
    const speedScore = avgTimeMs > 0 ? Math.max(0, Math.min(100, Math.round(100 - (avgTimeMs / 2000)))) : 0;

    // Consistency Score
    const consistencyScore = totalBattles > 0 ? Math.max(0, Math.min(100, Math.round(winRate * 0.8 + player.currentStreak * 5))) : 0;

    const radarStats = [
      { subject: "Debugging", A: debuggingScore, fullMark: 100 },
      { subject: "Architecture", A: architectureScore, fullMark: 100 },
      { subject: "Optimization", A: optimizationScore, fullMark: 100 },
      { subject: "Speed", A: speedScore, fullMark: 100 },
      { subject: "Consistency", A: consistencyScore, fullMark: 100 },
    ];

    // Sync badges (if any new ones are unlocked)
    const newBadges: string[] = [];
    if (player.totalWins >= 1) newBadges.push("First Blood");
    if (player.currentStreak >= 3) newBadges.push("Hat Trick");
    if (player.currentStreak >= 10) newBadges.push("Unbreakable");
    if (winsArch >= 10) newBadges.push("Architect");
    if (winsCrash >= 10) newBadges.push("Exterminator");
    
    const hasSpeedrun = allCompletedBattles.some((b) => {
      if (b.mode !== BattleMode.LOAD_BREAKER) return false;
      const playerSub = submissions.find((s) => s.battleId === b.id && s.timeTakenMs && s.timeTakenMs <= 60000);
      return !!playerSub;
    });
    if (hasSpeedrun) newBadges.push("Speedrun");
    if (totalBattles >= 100) newBadges.push("Centurion");
    if (player.eloRating >= 1600) newBadges.push("Elite");

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
      submissions,
      radarStats,
      bestMode,
      longestStreak,
      winRate,
      totalBattles,
    });
  } catch (error) {
    console.error("Error fetching profile API:", error);
    return NextResponse.json({ error: "Failed to fetch profile data" }, { status: 500 });
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
    console.error("Error updating profile bio:", error);
    return NextResponse.json({ error: "Failed to update profile bio" }, { status: 500 });
  }
}
