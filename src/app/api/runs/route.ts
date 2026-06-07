import { NextRequest, NextResponse } from "next/server";
import { getConvexClient } from "@/lib/convex";
import { convexFunctions } from "@/lib/convex-functions";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const convexClient = getConvexClient();
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const runs = await convexClient.query(convexFunctions.runs.listByProject, { projectId });
  return NextResponse.json({ runs });
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const convexClient = getConvexClient();
  const body = (await request.json()) as {
    projectId?: string;
    workflowId?: string;
    triggeredBy?: string;
    title?: string;
    storyBeat?: string;
    styleHint?: string;
  };

  if (!body.projectId || !body.workflowId || !body.title || !body.storyBeat) {
    return NextResponse.json(
      { error: "projectId, workflowId, title, and storyBeat are required" },
      { status: 400 },
    );
  }

  const runId = await convexClient.mutation(convexFunctions.runs.create, {
    projectId: body.projectId,
    workflowId: body.workflowId,
    triggeredBy: body.triggeredBy ?? "local-dev-owner",
    input: {
      title: body.title,
      storyBeat: body.storyBeat,
      styleHint: body.styleHint,
    },
  });

  return NextResponse.json({ runId });
};
