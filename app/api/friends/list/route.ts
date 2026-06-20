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

    const friendships = await prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: playerId },
          { receiverId: playerId },
        ],
      },
      include: {
        requester: {
          select: {
            id: true,
            username: true,
            avatar: true,
            eloRating: true,
          },
        },
        receiver: {
          select: {
            id: true,
            username: true,
            avatar: true,
            eloRating: true,
          },
        },
      },
    });

    const friends = friendships.map((f) => {
      const isRequester = f.requesterId === playerId;
      const friend = isRequester ? f.receiver : f.requester;
      return {
        ...friend,
        friendshipId: f.id,
      };
    });

    return NextResponse.json(friends);
  } catch (error) {
    console.error("Error listing friends:", error);
    return NextResponse.json({ error: "Failed to list friends" }, { status: 500 });
  }
}
