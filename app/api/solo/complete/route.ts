import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BattleStatus, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.player) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { challengeId, playerId, score, timeTakenMs, submission } = await request.json();

    const loggedInPlayerId = session.player.id;
    if (playerId !== loggedInPlayerId) {
      return NextResponse.json({ error: "Forbidden: Player mismatch" }, { status: 403 });
    }

    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    // Determine target Player record
    const player = await prisma.player.findUnique({
      where: { id: loggedInPlayerId },
    });

    if (!player) {
      return NextResponse.json({ error: "Player record not found" }, { status: 404 });
    }

    // 1. Create a dummy Battle record to associate with BattleSubmission
    const battleRoomId = `solo-${randomUUID()}`;
    const newBattle = await prisma.battle.create({
      data: {
        roomId: battleRoomId,
        mode: challenge.mode,
        status: BattleStatus.COMPLETED,
        player1Id: player.id,
        player2Id: null,
        winnerId: score > 0 ? player.id : null,
        startedAt: new Date(Date.now() - (timeTakenMs || 0)),
        endedAt: new Date(),
      },
    });

    // 2. Parse submission payload fields
    let codeSubmitted: string | null = null;
    let architectureJson: unknown = null;

    if (typeof submission === "string") {
      codeSubmitted = submission;
    } else if (submission && typeof submission === "object") {
      const subObj = submission as Record<string, unknown>;
      codeSubmitted = (subObj.textarea as string) || null;
      architectureJson = subObj.architectureJson || null;
    }

    // 3. Create the BattleSubmission record with solo = true
    await prisma.battleSubmission.create({
      data: {
        battleId: newBattle.id,
        playerId: player.id,
        score: score,
        timeTakenMs: timeTakenMs,
        codeSubmitted,
        architectureJson: architectureJson !== null ? (architectureJson as Prisma.InputJsonValue) : Prisma.JsonNull,
        solo: true,
      },
    });

    // 4. Update player stats
    const isSuccess = score > 0;
    let eloChange = 0;
    let streakChange = 0;
    
    if (isSuccess) {
      eloChange = 10; // +10 ELO for successful practice runs
      streakChange = 1;
      
      await prisma.player.update({
        where: { id: player.id },
        data: {
          eloRating: { increment: eloChange },
          totalWins: { increment: 1 },
          weeklyWins: { increment: 1 },
          currentStreak: { increment: streakChange },
        },
      });
    } else {
      await prisma.player.update({
        where: { id: player.id },
        data: {
          totalLosses: { increment: 1 },
          currentStreak: 0, // Reset streak
        },
      });
    }

    // Fetch updated ELO rating for return ELO division name
    const updatedPlayer = await prisma.player.findUnique({
      where: { id: player.id },
      select: { eloRating: true },
    });

    const finalRating = updatedPlayer?.eloRating ?? player.eloRating;

    const getEloDivisionName = (rating: number) => {
      if (rating < 1100) return "Iron";
      if (rating < 1300) return "Bronze";
      if (rating < 1500) return "Silver";
      if (rating < 1800) return "Gold";
      if (rating < 2100) return "Platinum";
      return "Diamond";
    };

    const division = getEloDivisionName(finalRating);
    const message = isSuccess 
      ? `Successfully completed practice run! +${eloChange} ELO rating awarded.`
      : `Challenge practice run finished. Streak reset to 0.`;

    return NextResponse.json({
      score,
      rank: division,
      message,
    });
  } catch (error) {
    console.error("Error completing solo run:", error);
    return NextResponse.json({ error: "Failed to complete practice challenge" }, { status: 500 });
  }
}
