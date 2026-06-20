import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.player) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";

    if (!q) {
      return NextResponse.json([]);
    }

    const currentUserId = session.player.id;

    const players = await prisma.player.findMany({
      where: {
        username: {
          contains: q,
          mode: "insensitive",
        },
        id: {
          not: currentUserId,
        },
      },
      select: {
        id: true,
        username: true,
        avatar: true,
        eloRating: true,
      },
      take: 10,
    });

    // Fetch friendships involving the current user and any of the matched users
    const playerIds = players.map(p => p.id);
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: currentUserId, receiverId: { in: playerIds } },
          { requesterId: { in: playerIds }, receiverId: currentUserId },
        ],
      },
    });

    const results = players.map((player) => {
      const friendship = friendships.find(
        (f) =>
          (f.requesterId === currentUserId && f.receiverId === player.id) ||
          (f.requesterId === player.id && f.receiverId === currentUserId)
      );

      let relationship = "NONE";
      if (friendship) {
        if (friendship.status === "ACCEPTED") {
          relationship = "FRIENDS";
        } else if (friendship.status === "PENDING") {
          relationship = friendship.requesterId === currentUserId ? "SENT" : "RECEIVED";
        }
      }

      return {
        ...player,
        relationship,
        friendshipId: friendship?.id || null,
      };
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error searching players:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
