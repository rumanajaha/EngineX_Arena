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

    const currentPId = session.player.id;

    // Fetch other players
    let otherPlayers = await prisma.player.findMany({
      where: {
        id: {
          not: currentPId,
        },
      },
      select: {
        id: true,
        username: true,
        avatar: true,
        eloRating: true,
      },
    });

    // Seed mock players if database has too few records, to make a high-fidelity presentation
    if (otherPlayers.length < 3) {
      const mockFriends = [
        {
          githubId: "999001",
          username: "SystemOverlord",
          avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=overlord",
          eloRating: 2250, // Diamond
          totalWins: 142,
          totalLosses: 34,
          currentStreak: 12,
          badges: ["Code Breaker", "Elite Architect"],
        },
        {
          githubId: "999002",
          username: "CodeNinja",
          avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=ninja",
          eloRating: 1850, // Platinum
          totalWins: 89,
          totalLosses: 45,
          currentStreak: 4,
          badges: ["Silent Debugger"],
        },
        {
          githubId: "999003",
          username: "BugSlayer",
          avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=slayer",
          eloRating: 1350, // Silver
          totalWins: 42,
          totalLosses: 38,
          currentStreak: 0,
          badges: ["Memory Hound"],
        },
        {
          githubId: "999004",
          username: "StackOverflowed",
          avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=stack",
          eloRating: 980, // Iron
          totalWins: 12,
          totalLosses: 29,
          currentStreak: 0,
          badges: [],
        },
      ];

      for (const friend of mockFriends) {
        await prisma.player.upsert({
          where: { githubId: friend.githubId },
          update: {},
          create: {
            githubId: friend.githubId,
            username: friend.username,
            avatar: friend.avatar,
            eloRating: friend.eloRating,
            totalWins: friend.totalWins,
            totalLosses: friend.totalLosses,
            currentStreak: friend.currentStreak,
            badges: friend.badges,
          },
        });
      }

      // Re-fetch
      otherPlayers = await prisma.player.findMany({
        where: {
          id: {
            not: currentPId,
          },
        },
        select: {
          id: true,
          username: true,
          avatar: true,
          eloRating: true,
        },
      });
    }

    return NextResponse.json(otherPlayers);
  } catch (error) {
    console.error("Error fetching friends:", error);
    return NextResponse.json({ error: "Failed to fetch friends" }, { status: 500 });
  }
}
