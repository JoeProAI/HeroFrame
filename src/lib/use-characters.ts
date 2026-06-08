"use client";

import { useCallback, useEffect, useState } from "react";

export type Character = {
  id: string;
  name: string;
  referenceUrl: string;
  notes?: string;
  createdAt: number;
};

const STORAGE_KEY = "heroframe.characters.v1";

const readStore = (): Character[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Character[]) : [];
  } catch {
    return [];
  }
};

const writeStore = (characters: Character[]): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(characters));
};

export const useCharacters = () => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Hydrate from localStorage after mount to avoid SSR/client mismatch.
    const stored = readStore();
    /* eslint-disable react-hooks/set-state-in-effect */
    setCharacters(stored);
    setActiveId(stored.at(0)?.id ?? null);
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (hydrated) writeStore(characters);
  }, [characters, hydrated]);

  const addCharacter = useCallback((name: string, referenceUrl: string, notes?: string): Character => {
    const character: Character = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim() || "Untitled hero",
      referenceUrl,
      notes: notes?.trim() || undefined,
      createdAt: Date.now(),
    };
    setCharacters((prev) => [character, ...prev]);
    setActiveId(character.id);
    return character;
  }, []);

  const removeCharacter = useCallback((id: string) => {
    setCharacters((prev) => prev.filter((character) => character.id !== id));
    setActiveId((current) => (current === id ? null : current));
  }, []);

  const activeCharacter = characters.find((character) => character.id === activeId) ?? null;

  return { characters, activeCharacter, activeId, setActiveId, addCharacter, removeCharacter, hydrated };
};
