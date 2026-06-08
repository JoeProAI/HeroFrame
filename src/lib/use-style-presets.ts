"use client";

import { useCallback, useEffect, useState } from "react";

export type StylePreset = {
  id: string;
  name: string;
  text: string;
};

const STORAGE_KEY = "heroframe.stylepresets.v1";

const seed: StylePreset[] = [
  { id: "seed-ink", name: "Bold ink cartoon", text: "bold black outlines, flat saturated cel color, high contrast" },
  { id: "seed-noir", name: "Cinematic noir", text: "dramatic rim lighting, deep shadows, moody palette" },
];

const read = (): StylePreset[] => {
  if (typeof window === "undefined") return seed;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StylePreset[]) : seed;
  } catch {
    return seed;
  }
};

export const useStylePresets = () => {
  const [presets, setPresets] = useState<StylePreset[]>(seed);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = read();
    /* eslint-disable react-hooks/set-state-in-effect */
    setPresets(stored);
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (hydrated && typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    }
  }, [presets, hydrated]);

  const addPreset = useCallback((name: string, text: string) => {
    if (!name.trim() || !text.trim()) return;
    const preset: StylePreset = { id: `${Date.now()}`, name: name.trim(), text: text.trim() };
    setPresets((prev) => [preset, ...prev]);
    setActiveId(preset.id);
  }, []);

  const activePreset = presets.find((preset) => preset.id === activeId) ?? null;

  return { presets, activePreset, activeId, setActiveId, addPreset };
};
