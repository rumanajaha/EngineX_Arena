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

    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      return NextResponse.json({ error: "Friendship not found" }, { status: 404 });
    }

    // Either party can decline or delete the friendship
    if (friendship.requesterId !== playerId && friendship.receiverId !== playerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.friendship.delete({
      where: { id: friendshipId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error declining friend request:", error);
    return NextResponse.json({ error: "Failed to decline request" }, { status: 500 });
  }
}
