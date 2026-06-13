import { NextResponse } from "next/server";
import { getConvexClient } from "@/lib/convex";
import { convexFunctions } from "@/lib/convex-functions";
import { frontEndDesignTemplate, heroFightLeagueTemplate } from "@/lib/workflow-templates";
import { toSlug } from "@/lib/slug";

export const POST = async (): Promise<NextResponse> => {
  const convexClient = getConvexClient();
  const ownerId = "local-dev-owner";
  const projectName = "HeroFrame Studio";
  const slug = toSlug(projectName);

  const projectId = await convexClient.mutation(convexFunctions.projects.upsert, {
    ownerId,
    name: projectName,
    slug,
    status: "active",
    description: "Main orchestration workspace for HeroFrame production workflows.",
  });

  const heroWorkflowId = await convexClient.mutation(convexFunctions.workflows.upsert, {
    projectId,
    name: heroFightLeagueTemplate.name,
    key: heroFightLeagueTemplate.key,
    version: heroFightLeagueTemplate.version,
    steps: heroFightLeagueTemplate.steps,
  });

  const designWorkflowId = await convexClient.mutation(convexFunctions.workflows.upsert, {
    projectId,
    name: frontEndDesignTemplate.name,
    key: frontEndDesignTemplate.key,
    version: frontEndDesignTemplate.version,
    steps: frontEndDesignTemplate.steps,
  });

  return NextResponse.json({ projectId, heroWorkflowId, designWorkflowId, ownerId });
};
