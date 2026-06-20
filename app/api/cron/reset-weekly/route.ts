import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Optionally check for Vercel cron authorization or a secret header if desired,
    // but here we support manual trigger as requested by the user.
    // We allow local manual triggers or Vercel cron headers
    // Reset weeklyWins to 0 for all players
    const updateResult = await prisma.player.updateMany({
      data: {
        weeklyWins: 0,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Weekly scores reset successfully.",
      count: updateResult.count,
    });
  } catch (error) {
    console.error("Error resetting weekly scores:", error);
    return NextResponse.json({ error: "Failed to reset weekly scores" }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
