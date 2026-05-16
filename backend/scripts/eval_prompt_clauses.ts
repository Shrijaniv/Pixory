/**
 * eval_prompt_clauses.ts
 *
 * Verifies that buildSystemPrompt() and buildRolePrompt() inject the correct
 * persona clauses for each of the 5 persona types.
 *
 * This guards against accidental regressions when editing curate.ts — if a
 * persona heading or key phrase disappears from the generated prompt, this
 * eval will catch it immediately.
 *
 * Run: npx tsx backend/scripts/eval_prompt_clauses.ts
 */

// ── Import the functions under test ──────────────────────────────────────────
// We import directly from source so the eval always tests the live version.
import { buildSystemPrompt, buildRolePrompt } from "../src/routes/curate.js";

// ── Assertion helpers ─────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function assertContains(prompt: string, phrase: string, label: string) {
  assert(
    prompt.includes(phrase),
    label,
    `Expected to find: "${phrase}"`,
  );
}

function assertNotContains(prompt: string, phrase: string, label: string) {
  assert(
    !prompt.includes(phrase),
    label,
    `Did NOT expect to find: "${phrase}"`,
  );
}

// ── buildSystemPrompt checks ──────────────────────────────────────────────────

console.log("\n── buildSystemPrompt: no persona (null) ──────────────────────────────");
{
  const p = buildSystemPrompt(10, 10, undefined, undefined, undefined);
  assertNotContains(p, "━━ POSTING PERSONA", "No persona heading injected when persona is null");
  assertContains(p, "Instagram carousel", "Base system prompt still present");
}

console.log("\n── buildSystemPrompt: aesthete ───────────────────────────────────────");
{
  const p = buildSystemPrompt(10, 10, undefined, undefined, undefined, undefined, "aesthete");
  assertContains(p, "THE AESTHETE", "Aesthete persona heading present");
  assertContains(p, "palette", "Mentions palette / color coherence");
  assertContains(p, "colors clash", "Mentions color-clash penalty");
  assertContains(p, "visual set", "Mentions coherent visual set");
  assertNotContains(p, "SOCIAL CONNECTOR", "No social heading in aesthete prompt");
}

console.log("\n── buildSystemPrompt: social ─────────────────────────────────────────");
{
  const p = buildSystemPrompt(10, 10, undefined, undefined, undefined, undefined, "social");
  assertContains(p, "SOCIAL CONNECTOR", "Social persona heading present");
  assertContains(p, "Tag me in that one", "Mentions tagging success metric");
  assertContains(p, "people in it", "Mentions every slide needs people");
  assertContains(p, "candid laughs", "Mentions candid / genuine expressions");
  assertNotContains(p, "THE AESTHETE", "No aesthete heading in social prompt");
}

console.log("\n── buildSystemPrompt: logger ─────────────────────────────────────────");
{
  const p = buildSystemPrompt(10, 10, undefined, undefined, undefined, undefined, "logger");
  assertContains(p, "EXPERIENCE LOGGER", "Logger persona heading present");
  assertContains(p, "documentary", "Mentions documentary instinct");
  assertContains(p, "authentic", "Mentions authenticity / rough edges");
  assertContains(p, "chronological", "Mentions chronological storytelling");
  assertNotContains(p, "THE MINIMALIST", "No minimalist heading in logger prompt");
}

console.log("\n── buildSystemPrompt: storyteller ────────────────────────────────────");
{
  const p = buildSystemPrompt(8, 8, undefined, undefined, undefined, undefined, "storyteller");
  assertContains(p, "THE STORYTELLER", "Storyteller persona heading present");
  assertContains(p, "sequences", "Mentions thinking in sequences");
  assertContains(p, "emotional arc", "Mentions emotional arc across slides");
  assertContains(p, "visual variety", "Mentions visual variety / diversity");
  // maxSelect=8 should appear in the storyteller's final sentence
  assertContains(p, "8", "maxSelect value (8) interpolated into storyteller clause");
}

console.log("\n── buildSystemPrompt: minimalist ─────────────────────────────────────");
{
  const p = buildSystemPrompt(5, 5, undefined, undefined, undefined, undefined, "minimalist");
  assertContains(p, "THE MINIMALIST", "Minimalist persona heading present");
  assertContains(p, "Less is always more", "Mentions 'Less is always more'");
  assertContains(p, "editorial discipline", "Mentions editorial discipline");
  assertContains(p, "exceptional", "Mentions only exceptional photos qualify");
  // maxSelect=5 should appear in the minimalist's clause
  assertContains(p, "5", "maxSelect value (5) interpolated into minimalist clause");
}

console.log("\n── buildSystemPrompt: vibe framing with persona ──────────────────────");
{
  const withPersona = buildSystemPrompt(10, 10, "Three days in Tokyo", undefined, undefined, undefined, "aesthete");
  assertContains(withPersona, "story the user wants to tell", "Vibe becomes 'story intent' when persona is set");
  assertNotContains(withPersona, "vibe/theme", "Generic vibe label suppressed when persona is set");

  const noPersona = buildSystemPrompt(10, 10, "Three days in Tokyo", undefined, undefined);
  assertContains(noPersona, "vibe/theme", "Generic vibe label present when no persona");
  assertNotContains(noPersona, "story the user wants to tell", "Story-intent framing absent without persona");
}

console.log("\n── buildSystemPrompt: contentMix suppressed when persona set ─────────");
{
  // Content-mix clause should NOT appear when a persona is set (persona supersedes it)
  const withPersona = buildSystemPrompt(10, 10, undefined, undefined, undefined, "people", "social");
  assertNotContains(withPersona, "CONTENT MIX", "Content-mix clause suppressed when persona is set");

  // Content-mix clause SHOULD appear when no persona is set
  const noPersona = buildSystemPrompt(10, 10, undefined, undefined, undefined, "people");
  assertContains(noPersona, "CONTENT MIX", "Content-mix clause injected when no persona");
}

// ── buildRolePrompt checks ────────────────────────────────────────────────────

console.log("\n── buildRolePrompt: no persona ───────────────────────────────────────");
{
  const p = buildRolePrompt(8);
  assertContains(p, "HOOK", "HOOK beat defined");
  assertContains(p, "WORLD", "WORLD beat defined");
  assertContains(p, "LIFE", "LIFE beat defined");
  assertContains(p, "DETAIL", "DETAIL beat defined");
  assertContains(p, "CLOSER", "CLOSER beat defined");
  assertNotContains(p, "━━ POSTING PERSONA", "No persona heading when persona is null");
}

console.log("\n── buildRolePrompt: aesthete ─────────────────────────────────────────");
{
  const p = buildRolePrompt(8, undefined, undefined, "aesthete");
  assertContains(p, "THE AESTHETE", "Aesthete persona heading in role prompt");
  assertContains(p, "palette", "Palette mention carried into role prompt");
  assertContains(p, "HOOK", "Story beats still defined alongside persona clause");
}

console.log("\n── buildRolePrompt: social ───────────────────────────────────────────");
{
  const p = buildRolePrompt(8, undefined, undefined, "social");
  assertContains(p, "SOCIAL CONNECTOR", "Social heading in role prompt");
  assertContains(p, "Tag me in that one", "Tagging metric in role prompt");
}

console.log("\n── buildRolePrompt: logger ───────────────────────────────────────────");
{
  const p = buildRolePrompt(8, undefined, undefined, "logger");
  assertContains(p, "EXPERIENCE LOGGER", "Logger heading in role prompt");
  assertContains(p, "documentary", "Documentary instinct in role prompt");
}

console.log("\n── buildRolePrompt: storyteller ──────────────────────────────────────");
{
  const p = buildRolePrompt(8, undefined, undefined, "storyteller");
  assertContains(p, "THE STORYTELLER", "Storyteller heading in role prompt");
  assertContains(p, "emotional arc", "Emotional arc in role prompt");
}

console.log("\n── buildRolePrompt: minimalist ───────────────────────────────────────");
{
  const p = buildRolePrompt(5, undefined, undefined, "minimalist");
  assertContains(p, "THE MINIMALIST", "Minimalist heading in role prompt");
  assertContains(p, "Less is always more", "Less-is-more in role prompt");
}

console.log("\n── buildRolePrompt: vibe + storyHint forwarded ───────────────────────");
{
  const p = buildRolePrompt(8, "Our Tokyo trip", "Hero → journey → reflection arc", "storyteller");
  assertContains(p, "Tokyo", "Vibe text forwarded into role prompt");
  assertContains(p, "reflection arc", "Story hint forwarded into role prompt");
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(55)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("EVAL FAILED — review persona clause generation in curate.ts");
  process.exit(1);
} else {
  console.log("All assertions pass ✓");
}
