import { NextRequest, NextResponse } from "next/server";
import { convexClient } from "@/lib/convex";
import { convexFunctions } from "@/lib/convex-functions";
import { toSlug } from "@/lib/slug";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const ownerId = request.nextUrl.searchParams.get("ownerId") ?? "local-dev-owner";
  const projects = await convexClient.query(convexFunctions.projects.list, { ownerId });
  return NextResponse.json({ projects });
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const body = (await request.json()) as {
    ownerId?: string;
    name?: string;
    description?: string;
    status?: "draft" | "active" | "archived";
  };
  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const ownerId = body.ownerId ?? "local-dev-owner";
  const projectId = await convexClient.mutation(convexFunctions.projects.upsert, {
    ownerId,
    name: body.name,
    slug: toSlug(body.name),
    description: body.description,
    status: body.status ?? "draft",
  });

  return NextResponse.json({ projectId });
};
