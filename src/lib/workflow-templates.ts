import type { WorkflowTemplate } from "@/types/workflow";

export const heroFightLeagueTemplate: WorkflowTemplate = {
  name: "Versus Builder v1",
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

export const frontEndDesignTemplate: WorkflowTemplate = {
  name: "Heroframe UI System v1",
  key: "heroframe-ui-system",
  version: 2,
  steps: [
    { id: "context", label: "Context and Constraints Capture", kind: "brief", required: true },
    { id: "direction", label: "Radical Art Direction Selection", kind: "design", required: true },
    { id: "signature", label: "Signature Interaction Element", kind: "design", required: true },
    { id: "tokens", label: "Design Token System Definition", kind: "design", required: true },
    { id: "composition", label: "Layout and Typography Composition", kind: "design", required: true },
    { id: "states", label: "Full Interaction States Pass", kind: "design", required: true },
    { id: "accessibility", label: "Accessibility and Keyboard QA", kind: "review", required: true },
    { id: "failure", label: "Failure and Recovery State Design", kind: "review", required: true },
    { id: "quality-gate", label: "Narrative Consistency Quality Gate", kind: "review", required: true },
    { id: "handoff", label: "Windsurf Handoff and Extension Notes", kind: "asset", required: false },
  ],
};

export const workflowTemplates: WorkflowTemplate[] = [heroFightLeagueTemplate, frontEndDesignTemplate];
