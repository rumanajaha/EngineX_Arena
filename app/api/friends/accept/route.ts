import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.player) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { friendshipId } = await request.json();
    const playerId = session.player.id;

    if (!friendshipId) {
      return NextResponse.json({ error: "Invalid friendship ID" }, { status: 400 });
    }

    // Verify friendship exists and receiver is the current player
    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      return NextResponse.json({ error: "Friendship not found" }, { status: 404 });
    }

    if (friendship.receiverId !== playerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.friendship.update({
      where: { id: friendshipId },
      data: {
        status: "ACCEPTED",
      },
    });

    return NextResponse.json({ success: true, friendship: updated });
  } catch (error) {
    console.error("Error accepting friend request:", error);
    return NextResponse.json({ error: "Failed to accept request" }, { status: 500 });
  }
}
