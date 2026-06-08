# Windsurf Front-End Design Workflow (Heroframe)

This workflow is now part of the Heroframe runtime template and is intended for every major UI pass in Windsurf.

## Workflow Key

- `heroframe-ui-system`
- Version `2`

## Sequence

1. **Context and Constraints Capture**
   - Define purpose, audience, framework constraints, accessibility and performance boundaries.
2. **Radical Art Direction Selection**
   - Commit to one clear visual direction. No mixed aesthetics.
3. **Signature Interaction Element**
   - Add one memorable, functional signature mechanism.
4. **Design Token System Definition**
   - Create/extend color, type, spacing, radius, motion, and semantic state tokens.
5. **Layout and Typography Composition**
   - Build hierarchy and rhythm with non-generic composition.
6. **Full Interaction States Pass**
   - Default, hover, active, focus-visible, disabled, loading, error, empty.
7. **Accessibility and Keyboard QA**
   - Semantic structure, keyboard traversal, visible focus, contrast checks.
8. **Failure and Recovery State Design**
   - Handle network, delay, partial-data, and user-error paths intentionally.
9. **Narrative Consistency Quality Gate**
   - Reject mismatched tone, generic patterns, or AI-trope visuals.
10. **Windsurf Handoff and Extension Notes**
   - Record how to extend without breaking visual coherence.

## Hard Rules

- No Inter/Roboto/Arial/system-default typography stacks as primary UI voice.
- No default purple SaaS gradient card aesthetic.
- No placeholder copy.
- No incomplete state coverage.
- No silent failure surfaces.

## Notes for Windsurf Sessions

- Keep styling token-driven and Tailwind-first.
- Keep custom CSS minimal and global, not ad-hoc.
- Prefer reusable UI sections over one-off visual hacks.
- Do not ship if the signature element is absent.
