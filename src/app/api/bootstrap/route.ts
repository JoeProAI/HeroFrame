import { NextResponse } from "next/server";
import { convexClient } from "@/lib/convex";
import { convexFunctions } from "@/lib/convex-functions";
import { heroFightLeagueTemplate } from "@/lib/workflow-templates";
import { toSlug } from "@/lib/slug";

export const POST = async (): Promise<NextResponse> => {
  const ownerId = "local-dev-owner";
  const projectName = "Cartoon Hero Course";
  const slug = toSlug(projectName);

  const projectId = await convexClient.mutation(convexFunctions.projects.upsert, {
    ownerId,
    name: projectName,
    slug,
    status: "active",
    description: "Main orchestration workspace for Cartoon Hero workflows.",
  });

  const workflowId = await convexClient.mutation(convexFunctions.workflows.upsert, {
    projectId,
    name: heroFightLeagueTemplate.name,
    key: heroFightLeagueTemplate.key,
    version: heroFightLeagueTemplate.version,
    steps: heroFightLeagueTemplate.steps,
  });

  return NextResponse.json({ projectId, workflowId, ownerId });
};
