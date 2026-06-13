"use client";

// BYOK client helpers. The user's Kie key and a per-browser owner id live only
// in localStorage and are sent as headers on every API call.
const KEY_STORAGE = "heroframe.kieKey";
const OWNER_STORAGE = "heroframe.owner";

export const getKieKey = (): string => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(KEY_STORAGE) ?? "";
};

export const setKieKey = (key: string): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_STORAGE, key.trim());
};

export const getOwnerId = (): string => {
  if (typeof window === "undefined") return "anon";
  let id = window.localStorage.getItem(OWNER_STORAGE);
  if (!id) {
    id = `u-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    window.localStorage.setItem(OWNER_STORAGE, id);
  }
  return id;
};

// fetch wrapper that injects the BYOK key + owner id headers.
export const hfFetch = (input: string, init: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(init.headers ?? {});
  const key = getKieKey();
  if (key) headers.set("x-kie-key", key);
  headers.set("x-hf-owner", getOwnerId());
  return fetch(input, { ...init, headers });
};
