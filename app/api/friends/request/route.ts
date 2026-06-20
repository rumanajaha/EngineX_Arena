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

    const { receiverId } = await request.json();
    const requesterId = session.player.id;

    if (!receiverId || requesterId === receiverId) {
      return NextResponse.json({ error: "Invalid receiver ID" }, { status: 400 });
    }

    // Check if friendship already exists
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId, receiverId },
          { requesterId: receiverId, receiverId: requesterId },
        ],
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Friendship request already exists or is pending", friendship: existing }, { status: 400 });
    }

    const friendship = await prisma.friendship.create({
      data: {
        requesterId,
        receiverId,
        status: "PENDING",
      },
    });

    return NextResponse.json({ success: true, friendship });
  } catch (error) {
    console.error("Error creating friend request:", error);
    return NextResponse.json({ error: "Failed to send request" }, { status: 500 });
  }
}
