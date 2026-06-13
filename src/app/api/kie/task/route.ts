import { NextRequest, NextResponse } from "next/server";
import { getKieTask } from "@/lib/kie/client";
import { resolveKieKey } from "@/lib/kie/env";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const taskId = request.nextUrl.searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json({ error: "taskId is required." }, { status: 400 });
  }

  let apiKey: string;
  try {
    apiKey = resolveKieKey(request.headers.get("x-kie-key"));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No Kie API key." }, { status: 401 });
  }

  try {
    const record = await getKieTask(taskId, apiKey);
    return NextResponse.json({
      ok: true,
      taskId: record.taskId,
      state: record.state,
      pending: record.state !== "success" && record.state !== "fail",
      resultUrl: record.resultUrls.at(0) ?? "",
      resultUrls: record.resultUrls,
      failMsg: record.failMsg,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Kie task lookup failed." },
      { status: 502 },
    );
  }
};
