export type StepKind =
  | "brief"
  | "prompt"
  | "asset"
  | "voice"
  | "render"
  | "review"
  | "design";

export type WorkflowStep = {
  id: string;
  label: string;
  kind: StepKind;
  required: boolean;
};

export type WorkflowTemplate = {
  name: string;
  key: string;
  version: number;
  steps: WorkflowStep[];
};

export type RunInput = {
  title: string;
  storyBeat: string;
  styleHint?: string;
};

export type RunOutput = {
  promptPackUrl?: string;
  shotList: string[];
  renderJobs: string[];
};
