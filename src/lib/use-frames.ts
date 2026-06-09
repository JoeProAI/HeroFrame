"use client";

import { useCallback, useEffect, useState } from "react";

export type Frame = {
  id: string;
  url: string;
  type: "image" | "video";
  prompt: string;
  characterName?: string;
  shot?: string;
  createdAt: number;
};

const STORAGE_KEY = "heroframe.frames.v1";

const read = (): Frame[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Frame[]) : [];
  } catch {
    return [];
  }
};

export const useFrames = () => {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setFrames(read());
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (hydrated && typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(frames.slice(0, 60)));
    }
  }, [frames, hydrated]);

  const addFrame = useCallback((frame: Omit<Frame, "id" | "createdAt">) => {
    setFrames((prev) => [
      { ...frame, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: Date.now() },
      ...prev,
    ]);
  }, []);

  const clearFrames = useCallback(() => setFrames([]), []);

  return { frames, addFrame, clearFrames };
};
