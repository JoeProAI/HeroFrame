import { NextRequest, NextResponse } from "next/server";
import { publishGhostPost } from "@/lib/ghost/client";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const buildHtml = (storyBeat: string, styleHint?: string): string => {
  const beat = `<p>${escapeHtml(storyBeat)}</p>`;
  const style = styleHint ? `<p><strong>Visual direction:</strong> ${escapeHtml(styleHint)}</p>` : "";
  return `${beat}${style}`;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  let body: {
    title?: string;
    storyBeat?: string;
    styleHint?: string;
    html?: string;
    status?: "draft" | "published";
    tags?: string[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title is required." }, { status: 400 });
  }

  const html = body.html?.trim() || buildHtml(body.storyBeat ?? "", body.styleHint);
  if (!html.trim()) {
    return NextResponse.json({ error: "html or storyBeat is required." }, { status: 400 });
  }

  try {
    const result = await publishGhostPost({
      title: body.title,
      html,
      status: body.status ?? "draft",
      tags: body.tags ?? ["Heroframe"],
    });
    return NextResponse.json({ ok: true, post: result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown Ghost error." },
      { status: 502 },
    );
  }
};
