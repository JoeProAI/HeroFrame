import { NextRequest, NextResponse } from "next/server";

// Kie posts task completion here when callBackUrl is set. We acknowledge fast
// (2xx) so Kie does not retry. Persisting results into Convex is a later step.
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const data = (payload as { data?: { taskId?: string; state?: string } } | null)?.data;
  return NextResponse.json({
    ok: true,
    received: true,
    taskId: data?.taskId ?? null,
    state: data?.state ?? null,
  });
};
