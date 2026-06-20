import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BattleStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rooms = await prisma.battle.findMany({
      where: {
        status: BattleStatus.WAITING,
      },
      include: {
        player1: {
          select: {
            username: true,
            avatar: true,
            eloRating: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(rooms);
  } catch (error) {
    console.error("Error fetching public rooms:", error);
    return NextResponse.json({ error: "Failed to fetch rooms" }, { status: 500 });
  }
}
