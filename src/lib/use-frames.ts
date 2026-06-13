"use client";

import { useCallback, useEffect, useState } from "react";
import { hfFetch } from "@/lib/hf-client";

export type Frame = {
  id: string;
  url: string;
  type: "image" | "video";
  prompt: string;
  characterName?: string;
  shot?: string;
  createdAt: number;
};

export type Generation = {
  _id: string;
  kind: string;
  status: "succeeded" | "failed";
  prompt: string;
  model?: string;
  url?: string;
  type?: "image" | "video";
  characterName?: string;
  shot?: string;
  error?: string;
  createdAt: number;
};

type LogInput = {
  kind: "reference" | "scene" | "variation" | "fight" | "video" | "adhoc";
  status: "succeeded" | "failed";
  prompt: string;
  model?: string;
  url?: string;
  type?: "image" | "video";
  characterName?: string;
  shot?: string;
  error?: string;
};

export const useFrames = () => {
  const [history, setHistory] = useState<Generation[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await hfFetch("/api/generations");
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; generations?: Generation[] } | null;
      if (res.ok && payload?.ok) setHistory(payload.generations ?? []);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  // Log any generation (success or failure) to Convex, then refresh.
  const logGeneration = useCallback(
    async (input: LogInput) => {
      try {
        await hfFetch("/api/generations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
      } catch {
        // non-fatal
      }
      await refresh();
    },
    [refresh],
  );

  // Back-compat helper used by the generators in the UI.
  const addFrame = useCallback(
    (frame: { url: string; type: "image" | "video"; prompt: string; characterName?: string; shot?: string; kind?: LogInput["kind"]; model?: string }) =>
      logGeneration({
        kind: frame.kind ?? (frame.type === "video" ? "video" : "scene"),
        status: "succeeded",
        prompt: frame.prompt,
        url: frame.url,
        type: frame.type,
        characterName: frame.characterName,
        shot: frame.shot,
        model: frame.model,
      }),
    [logGeneration],
  );

  const clearFrames = useCallback(async () => {
    await hfFetch("/api/generations", { method: "DELETE" }).catch(() => {});
    await refresh();
  }, [refresh]);

  // Successful image/video results, newest first, for the Frames gallery.
  const frames: Frame[] = history
    .filter((g) => g.status === "succeeded" && g.url)
    .map((g) => ({
      id: g._id,
      url: g.url as string,
      type: g.type ?? "image",
      prompt: g.prompt,
      characterName: g.characterName,
      shot: g.shot,
      createdAt: g.createdAt,
    }));

  return { frames, history, addFrame, logGeneration, clearFrames, refresh };
};
