import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BattleStatus } from "@/app/generated/prisma/client";

export async function POST(request: Request) {
  try {
    const { battleId, winnerId } = await request.json();

    if (!battleId) {
      return NextResponse.json({ error: "Missing battleId" }, { status: 400 });
    }

    const battle = await prisma.battle.findUnique({
      where: { id: battleId },
      include: {
        player1: true,
        player2: true,
      },
    });

    if (!battle) {
      return NextResponse.json({ error: "Battle not found" }, { status: 404 });
    }

    // Identify winner and loser players
    const isPlayer1Winner = battle.player1Id === winnerId;
    const winner = isPlayer1Winner ? battle.player1 : battle.player2;
    const loser = isPlayer1Winner ? battle.player2 : battle.player1;

    if (!winner || !loser) {
      return NextResponse.json({ error: "Winner or loser not found in battle" }, { status: 400 });
    }

    // Calculate ELO Changes
    // winner +25-40, loser -15-30
    const eloDifference = loser.eloRating - winner.eloRating;
    const winnerChange = Math.min(40, Math.max(25, 30 + Math.round(eloDifference / 20)));
    const loserChange = Math.min(30, Math.max(15, 20 + Math.round(eloDifference / 40)));

    const newWinnerElo = winner.eloRating + winnerChange;
    const newLoserElo = Math.max(100, loser.eloRating - loserChange);

    // Update Winner Player record
    await prisma.player.update({
      where: { id: winner.id },
      data: {
        eloRating: newWinnerElo,
        totalWins: { increment: 1 },
        weeklyWins: { increment: 1 },
        currentStreak: { increment: 1 },
      },
    });

    // Update Loser Player record
    await prisma.player.update({
      where: { id: loser.id },
      data: {
        eloRating: newLoserElo,
        totalLosses: { increment: 1 },
        currentStreak: 0,
      },
    });

    // Update Battle record
    await prisma.battle.update({
      where: { id: battleId },
      data: {
        status: BattleStatus.COMPLETED,
        winnerId,
        endedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      winnerId,
      winnerChange,
      loserChange,
      newWinnerElo,
      newLoserElo,
    });
  } catch (error) {
    console.error("Error completing battle:", error);
    return NextResponse.json({ error: "Failed to complete battle" }, { status: 500 });
  }
}
