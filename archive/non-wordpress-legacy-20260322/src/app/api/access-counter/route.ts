import { NextResponse } from "next/server";
import { hitAccessCounter, isValidCounterKey, readAccessCounter } from "@/lib/access-counter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  key?: unknown;
};

function toSafeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "unexpected error";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key")?.trim() ?? "";

  if (!isValidCounterKey(key)) {
    return NextResponse.json(
      { error: "invalid key. key must match /^[a-z0-9][a-z0-9:_/-]{0,127}$/" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(readAccessCounter(key), { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: toSafeErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!isValidCounterKey(key)) {
    return NextResponse.json(
      { error: "invalid key. key must match /^[a-z0-9][a-z0-9:_/-]{0,127}$/" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(hitAccessCounter(key), { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: toSafeErrorMessage(error) }, { status: 500 });
  }
}
