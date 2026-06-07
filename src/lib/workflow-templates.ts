import type { WorkflowTemplate } from "@/types/workflow";

export const heroFightLeagueTemplate: WorkflowTemplate = {
  name: "Hero Fight League v1",
  key: "hero-fight-league",
  version: 1,
  steps: [
    { id: "brief", label: "Fight Brief", kind: "brief", required: true },
    { id: "fighters", label: "Fighter Prompt Sheets", kind: "prompt", required: true },
    { id: "arena", label: "Arena and Camera Plan", kind: "asset", required: true },
    { id: "voice", label: "Voice and Sound Draft", kind: "voice", required: false },
    { id: "render", label: "Render Queue", kind: "render", required: true },
    { id: "review", label: "Quality Review", kind: "review", required: true },
  ],
};

export const workflowTemplates: WorkflowTemplate[] = [heroFightLeagueTemplate];
