import { NextRequest, NextResponse } from "next/server";
import { convexClient } from "@/lib/convex";
import { convexFunctions } from "@/lib/convex-functions";
import { heroFightLeagueTemplate } from "@/lib/workflow-templates";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const workflows = await convexClient.query(convexFunctions.workflows.listByProject, { projectId });
  return NextResponse.json({ workflows });
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const body = (await request.json()) as { projectId?: string };
  if (!body.projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const workflowId = await convexClient.mutation(convexFunctions.workflows.upsert, {
    projectId: body.projectId,
    name: heroFightLeagueTemplate.name,
    key: heroFightLeagueTemplate.key,
    version: heroFightLeagueTemplate.version,
    steps: heroFightLeagueTemplate.steps,
  });

  return NextResponse.json({ workflowId });
};
