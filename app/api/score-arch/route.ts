import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { textarea } = await request.json();

    if (!textarea) {
      return NextResponse.json({ error: "Missing design description" }, { status: 400 });
    }

    // High-quality mock AI architecture evaluation
    const aiScore = Math.floor(Math.random() * 20) + 75; // 75 - 95
    const feedback = `The architecture layout covers Client, Server, Database, Cache, and Message Queue elements. The proposed structure is solid for handling heavy loads, though edge optimizations could be detailed.`;

    return NextResponse.json({
      score: aiScore,
      feedback,
    });
  } catch (error) {
    console.error("Error scoring architecture:", error);
    return NextResponse.json({ error: "Failed to score architecture" }, { status: 500 });
  }
}
