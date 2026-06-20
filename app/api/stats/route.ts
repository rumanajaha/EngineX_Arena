import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let engineersOnline = 247;
    try {
      const socketRes = await fetch("http://localhost:3001/api/online-count", {
        next: { revalidate: 0 },
        // Add a small timeout
        signal: AbortSignal.timeout(1000),
      });
      if (socketRes.ok) {
        const socketData = await socketRes.json();
        engineersOnline = socketData.count || 247;
      }
    } catch (e) {
      console.warn("Could not connect to socket server for online count, using default:", e);
    }

    const battlesFought = await prisma.battle.count();
    const challengesAvailable = await prisma.challenge.count();

    return NextResponse.json({
      engineersOnline,
      battlesFought,
      challengesAvailable,
    });
  } catch (error) {
    console.error("Error in /api/stats:", error);
    // Return standard fallback values on error
    return NextResponse.json({
      engineersOnline: 247,
      battlesFought: 1842,
      challengesAvailable: 45,
    });
  }
}
