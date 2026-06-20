import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BattleMode, BattleStatus } from "@/app/generated/prisma/client";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Check if there are challenges in the database
    let challenges = await prisma.challenge.findMany();

    if (challenges.length === 0) {
      // Seed default challenges for each mode
      const seed1 = await prisma.challenge.create({
        data: {
          mode: BattleMode.SYSTEM_CRASH,
          title: "Memory Leak: Array Sum Overflow",
          description: "Analyze the code to find the index-out-of-bounds issue. The function is supposed to sum all integers in an array but accesses an uninitialized element.",
          difficulty: "EASY",
          brokenCode: `// Fix the bug in this sum array function
function sumArray(arr) {
  let total = 0;
  for (let i = 0; i <= arr.length; i++) { // Bug: <= includes undefined at arr.length
    total += arr[i];
  }
  return total;
}`,
          benchmarkMs: 300,
          testCases: [
            { input: "[1, 2, 3]", expected: "6" },
            { input: "[10, -5, 20]", expected: "25" }
          ],
        }
      });

      const seed2 = await prisma.challenge.create({
        data: {
          mode: BattleMode.LOAD_BREAKER,
          title: "Query Optimization: Nested Loop Sort",
          description: "Optimize the sorting algorithm to run within the required execution time threshold of 100ms. The current implementation uses bubble sort.",
          difficulty: "MEDIUM",
          slowCode: `// Optimize this slow bubble sort algorithm
function sortArray(arr) {
  let len = arr.length;
  for (let i = 0; i < len; i++) {
    for (let j = 0; j < len; j++) {
      if (arr[j] > arr[j + 1]) {
        let temp = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = temp;
      }
    }
  }
  return arr;
}`,
          benchmarkMs: 100,
          testCases: [
            { input: "[5, 3, 8, 1]", expected: "[1, 3, 5, 8]" },
            { input: "[-2, 10, 0]", expected: "[-2, 0, 10]" }
          ],
        }
      });

      const seed3 = await prisma.challenge.create({
        data: {
          mode: BattleMode.ARCH_WARS,
          title: "Microservices Scalability: Message Broker Design",
          description: "Architect a robust message queue routing mechanism to buffer spike requests of up to 100k requests/second.",
          difficulty: "HARD",
          designPrompt: "Design a highly scalable, real-time message broker backend system for handling 100k requests/sec. The design should utilize a CDN, Client, Message Queue, Cache, Database, and Server nodes.",
          testCases: [],
        }
      });

      challenges = [seed1, seed2, seed3];
    }

    // Select challenge based on the date
    const today = new Date();
    const day = today.getDate(); // 1-31
    const challenge = challenges[day % challenges.length];

    // Count how many submissions were made today for this challenge
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const solvedCount = await prisma.battleSubmission.count({
      where: {
        submittedAt: {
          gte: startOfToday,
          lte: endOfToday,
        },
        battle: {
          mode: challenge.mode,
        }
      }
    });

    return NextResponse.json({
      challenge,
      solvedCount,
    });
  } catch (error) {
    console.error("Error fetching daily challenge:", error);
    return NextResponse.json({ error: "Failed to fetch daily challenge" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.player) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const playerId = session.player.id;

    // Get today's challenge to know the mode
    const challenges = await prisma.challenge.findMany();
    if (challenges.length === 0) {
      return NextResponse.json({ error: "No challenges seeded" }, { status: 500 });
    }

    const today = new Date();
    const day = today.getDate();
    const challenge = challenges[day % challenges.length];

    const roomId = `solo-${randomUUID()}`;

    // Create a solo battle
    const battle = await prisma.battle.create({
      data: {
        roomId,
        mode: challenge.mode,
        status: BattleStatus.IN_PROGRESS,
        player1Id: playerId,
        startedAt: new Date(),
      },
    });

    return NextResponse.json({ roomId: battle.roomId });
  } catch (error) {
    console.error("Error creating daily challenge battle:", error);
    return NextResponse.json({ error: "Failed to create battle" }, { status: 500 });
  }
}
