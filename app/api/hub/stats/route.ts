import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.player) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const playerId = session.player.id;

    // Fetch latest player details from DB
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        username: true,
        avatar: true,
        eloRating: true,
        totalWins: true,
        totalLosses: true,
        currentStreak: true,
        badges: true,
      },
    });

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    return NextResponse.json(player);
  } catch (error) {
    console.error("Error fetching player hub stats:", error);
    return NextResponse.json({ error: "Failed to fetch player stats" }, { status: 500 });
  }
}
