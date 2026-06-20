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

    const pendingRequests = await prisma.friendship.findMany({
      where: {
        receiverId: playerId,
        status: "PENDING",
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
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const requests = pendingRequests.map((req) => ({
      friendshipId: req.id,
      requester: req.requester,
      createdAt: req.createdAt,
    }));

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Error listing friend requests:", error);
    return NextResponse.json({ error: "Failed to list requests" }, { status: 500 });
  }
}
