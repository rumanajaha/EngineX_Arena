import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BattleStatus } from "@/app/generated/prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.player) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const playerId = session.player.id;

    // Fetch the last 5 completed battles where the current player was involved
    const battles = await prisma.battle.findMany({
      where: {
        status: BattleStatus.COMPLETED,
        OR: [
          { player1Id: playerId },
          { player2Id: playerId },
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
      take: 5,
    });

    return NextResponse.json(battles);
  } catch (error) {
    console.error("Error fetching recent battles:", error);
    return NextResponse.json({ error: "Failed to fetch recent battles" }, { status: 500 });
  }
}
