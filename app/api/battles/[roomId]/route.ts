import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  const { roomId } = params;

  try {
    const battle = await prisma.battle.findUnique({
      where: { roomId },
      include: {
        player1: true,
        player2: true,
      },
    });

    if (!battle) {
      return NextResponse.json({ error: "Battle not found" }, { status: 404 });
    }

    // Load a challenge for this battle's mode
    // We fetch a challenge of this mode. If none exists, we create a default placeholder challenge.
    let challenge = await prisma.challenge.findFirst({
      where: { mode: battle.mode },
    });

    if (!challenge) {
      // Create seed challenges if none exist so the page loads and runs perfectly
      challenge = await prisma.challenge.create({
        data: {
          mode: battle.mode,
          title: `Default ${battle.mode} Challenge`,
          description: `Optimize or debug the system parameters for ${battle.mode}. Achieve optimal throughput and logic correctness.`,
          difficulty: "MEDIUM",
          brokenCode: `// Fix the bug in this sum array function
function sumArray(arr) {
  let total = 0;
  for (let i = 0; i <= arr.length; i++) { // Bug: <= includes undefined at arr.length
    total += arr[i];
  }
  return total;
}`,
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
          designPrompt: `Design a highly scalable, real-time message broker backend system for handling 100k requests/sec. The design should utilize a CDN, Client, Message Queue, Cache, Database, and Server nodes.`,
          benchmarkMs: 500,
          testCases: [
            { input: "[1, 2, 3]", expected: "6" },
            { input: "[10, -5, 20]", expected: "25" }
          ],
        },
      });
    }

    return NextResponse.json({
      battle,
      challenge,
    });
  } catch (error) {
    console.error("Error fetching battle details:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
