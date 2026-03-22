import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "blog",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
