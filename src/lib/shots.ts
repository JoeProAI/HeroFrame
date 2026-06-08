// Deterministic shot-list expansion. Turns one story beat into a coordinated
// sequence of framed shots — no LLM call, so it is free and predictable.

export type Shot = {
  label: string;
  framing: string;
};

const shotLadder: Shot[] = [
  { label: "Establishing", framing: "wide establishing shot, full environment" },
  { label: "Medium", framing: "medium shot, character centered" },
  { label: "Close-up", framing: "tight close-up on the character's face, strong expression" },
  { label: "Action", framing: "dynamic low-angle action pose, motion lines" },
  { label: "Reaction", framing: "over-the-shoulder reaction shot" },
  { label: "Finisher", framing: "dramatic hero finishing shot, bold silhouette" },
];

export const expandShots = (beat: string, count: number): { label: string; prompt: string }[] => {
  const clean = beat.trim();
  const n = Math.max(1, Math.min(count, shotLadder.length));
  return shotLadder.slice(0, n).map((shot) => ({
    label: shot.label,
    prompt: `${shot.framing}. ${clean}`,
  }));
};

// Hero Fight League sequence built from two named fighters.
export const buildFightShots = (
  fighterA: string,
  fighterB: string,
  arena: string,
): { label: string; prompt: string }[] => {
  const place = arena.trim() || "a neon fight arena";
  return [
    { label: `${fighterA} intro`, prompt: `Intro card for ${fighterA}, heroic entrance pose, ${place}, bold cartoon outlines` },
    { label: `${fighterB} intro`, prompt: `Intro card for ${fighterB}, menacing entrance pose, ${place}, bold cartoon outlines` },
    { label: "Face-off", prompt: `${fighterA} and ${fighterB} face off, both in frame, tense stand-off, ${place}` },
    { label: "Clash", prompt: `${fighterA} and ${fighterB} clash mid-air, dynamic action, impact effects, ${place}` },
    { label: "Turning point", prompt: `${fighterB} lands a heavy blow on ${fighterA}, dramatic angle, ${place}` },
    { label: "Finisher", prompt: `${fighterA} delivers a finishing move, both fighters in frame, explosive finish, ${place}` },
  ];
};
