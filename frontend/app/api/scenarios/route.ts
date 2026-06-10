import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/scenarios — list the current user's saved scenarios
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scenarios = await prisma.scenario.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ scenarios });
}

// POST /api/scenarios — save a new scenario for the current user
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, wCo2, wCost, wStr, minStrength, bestMix } = body;

    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Scenario name is required." },
        { status: 400 },
      );
    }

    const scenario = await prisma.scenario.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        wCo2: Number(wCo2) || 0,
        wCost: Number(wCost) || 0,
        wStr: Number(wStr) || 0,
        minStrength: Number(minStrength) || 0,
        bestMix: bestMix ?? undefined,
      },
    });
    return NextResponse.json({ scenario }, { status: 201 });
  } catch (err) {
    console.error("save scenario error", err);
    return NextResponse.json(
      { error: "Failed to save scenario." },
      { status: 500 },
    );
  }
}
