"use client";

import { useCallback, useEffect, useState } from "react";
import { hfFetch } from "@/lib/hf-client";

export type Character = {
  id: string;
  name: string;
  referenceUrl: string;
  notes?: string;
};

type ConvexCharacter = {
  _id: string;
  name: string;
  referenceUrl: string;
  notes?: string;
};

const normalize = (rows: ConvexCharacter[]): Character[] =>
  rows.map((r) => ({ id: r._id, name: r.name, referenceUrl: r.referenceUrl, notes: r.notes }));

export const useCharacters = () => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [deleted, setDeleted] = useState<Character[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await hfFetch("/api/characters?scope=active");
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; characters?: ConvexCharacter[] } | null;
      if (res.ok && payload?.ok) {
        const list = normalize(payload.characters ?? []);
        setCharacters(list);
        setActiveId((cur) => cur ?? list.at(0)?.id ?? null);
      }
    } catch {
      // non-fatal; Convex may be unreachable
    }
  }, []);

  const loadDeleted = useCallback(async () => {
    try {
      const res = await hfFetch("/api/characters?scope=deleted");
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; characters?: ConvexCharacter[] } | null;
      if (res.ok && payload?.ok) setDeleted(normalize(payload.characters ?? []));
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const addCharacter = useCallback(
    async (name: string, referenceUrl: string, notes?: string) => {
      const res = await hfFetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, referenceUrl, notes }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; id?: string; error?: string } | null;
      if (!res.ok || !payload?.ok) throw new Error(payload?.error ?? "Failed to save character.");
      await refresh();
      if (payload.id) setActiveId(payload.id);
    },
    [refresh],
  );

  const mutate = useCallback(
    async (id: string, action: "delete" | "restore" | "purge") => {
      await hfFetch("/api/characters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      await refresh();
      await loadDeleted();
    },
    [refresh, loadDeleted],
  );

  const removeCharacter = useCallback((id: string) => mutate(id, "delete"), [mutate]);
  const restoreCharacter = useCallback((id: string) => mutate(id, "restore"), [mutate]);
  const purgeCharacter = useCallback((id: string) => mutate(id, "purge"), [mutate]);

  const activeCharacter = characters.find((c) => c.id === activeId) ?? null;

  return {
    characters,
    deleted,
    activeCharacter,
    activeId,
    setActiveId,
    addCharacter,
    removeCharacter,
    restoreCharacter,
    purgeCharacter,
    loadDeleted,
    refresh,
  };
};
