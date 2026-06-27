/**
 * AI curation — calls Claude or GPT-4o vision to select and caption photos.
 * Also handles role assignment for the review screen.
 */
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { ANTHROPIC_API_KEY, CLAUDE_VISION_MODEL, OPENAI_API_KEY, OPENAI_VISION_MODEL } from '../config';
import type { AssignRolesResult, CurateResult, FaceProfile, PhotoMetadata, PhotoRole } from '../types/curateTypes';
import { buildRolePrompt, buildSystemPrompt } from './promptBuilder';

// ── Response parsers ──────────────────────────────────────────────────────────

export function parseAiResponse(text: string): Omit<CurateResult, 'success'> {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    const preview = cleaned.slice(0, 120);
    throw new Error(`AI returned prose instead of JSON: "${preview}" — try Claude instead or retry`);
  }

  const parsed = JSON.parse(cleaned);

  if (!parsed.selected && !parsed.selected_indices) {
    const errKey = parsed.error ?? parsed.message ?? parsed.reason ?? JSON.stringify(parsed).slice(0, 120);
    throw new Error(`AI returned an error response: ${errKey}`);
  }

  const selected: Array<{ index: number; role: string; reason: string }> = parsed.selected ?? [];
  const selectedIndices = selected.map((s) => s.index);
  const photoRoles: PhotoRole[] = selected.map((s) => ({
    index: s.index,
    role: s.role as PhotoRole['role'],
    reason: s.reason,
  }));

  return {
    selected_indices: selectedIndices,
    photo_roles: photoRoles,
    ordering: parsed.ordering ?? selectedIndices,
    story: parsed.story ?? '',
    missing: parsed.missing ?? null,
    captions: parsed.captions ?? [],
    notes: parsed.notes ?? '',
  };
}

export function parseRoleResponse(text: string, count: number): AssignRolesResult {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    throw new Error(`AI returned prose instead of JSON: "${cleaned.slice(0, 120)}"`);
  }

  const parsed = JSON.parse(cleaned);
  const selected: Array<{ index: number; role: string; reason: string }> = parsed.selected ?? [];
  const photoRoles: PhotoRole[] = selected.map((s) => ({
    index: s.index,
    role: s.role as PhotoRole['role'],
    reason: s.reason,
  }));
  const fallback = Array.from({ length: count }, (_, i) => i);
  return {
    photo_roles: photoRoles,
    ordering: parsed.ordering ?? fallback,
    story: parsed.story ?? '',
    missing: parsed.missing ?? null,
  };
}

// ── Claude curation ───────────────────────────────────────────────────────────

export async function curateWithClaude(
  photos: string[],
  names: string[],
  vibe: string | undefined,
  maxSelect: number,
  faceProfiles?: FaceProfile[],
  favoriteIndices?: number[],
  contentMix?: string,
  persona?: string,
  userFaceB64?: string,
  photoMetadata?: PhotoMetadata[],
): Promise<Omit<CurateResult, 'success'>> {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const content: Anthropic.MessageParam['content'] = [];

  // Send the user's reference face FIRST so it's the clearest anchor for the AI.
  if (userFaceB64) {
    content.push({ type: 'text', text: '--- REFERENCE PHOTO — THE USER ---\nThis is the person who is posting. If a candidate photo contains faces, this person must be present or the photo must be excluded.' });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: userFaceB64 } });
    content.push({ type: 'text', text: '--- END REFERENCE — CANDIDATE PHOTOS FOLLOW ---' });
  }

  for (let i = 0; i < photos.length; i++) {
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photos[i] } });
    const meta = photoMetadata?.[i];
    const tags = [
      meta?.shot_type ? `[${meta.shot_type.toUpperCase()}]` : '',
      meta?.group_size && meta.group_size !== 'none' ? `[${meta.group_size.toUpperCase()}]` : '',
      favoriteIndices?.includes(i) ? '[♥ FAVORITED]' : '',
    ].filter(Boolean).join(' ');
    content.push({ type: 'text', text: `Photo ${i}: ${names[i] ?? `photo_${i}`}${tags ? ` ${tags}` : ''}` });
  }

  if (faceProfiles && faceProfiles.length > 0) {
    content.push({ type: 'text', text: '\n--- Face profiles for people to prioritize ---' });
    for (const fp of faceProfiles) {
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: fp.samplePhotoB64 } });
      content.push({ type: 'text', text: `Person named: ${fp.name}` });
    }
  }

  content.push({
    type: 'text',
    text: buildSystemPrompt(photos.length, maxSelect, vibe, faceProfiles, favoriteIndices, contentMix, persona, !!userFaceB64),
  });

  const response = await client.messages.create({
    model: CLAUDE_VISION_MODEL,
    max_tokens: 2048,
    messages: [{ role: 'user', content }],
  });

  const text = (response.content[0] as Anthropic.TextBlock).text;
  return parseAiResponse(text);
}

// ── OpenAI curation ───────────────────────────────────────────────────────────

export async function curateWithOpenAI(
  photos: string[],
  names: string[],
  vibe: string | undefined,
  maxSelect: number,
  faceProfiles?: FaceProfile[],
  favoriteIndices?: number[],
  contentMix?: string,
  persona?: string,
  userFaceB64?: string,
  photoMetadata?: PhotoMetadata[],
): Promise<Omit<CurateResult, 'success'>> {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const imageContent: OpenAI.Chat.ChatCompletionContentPart[] = [];

  // Send the user's reference face FIRST so it's the clearest anchor for the AI.
  if (userFaceB64) {
    imageContent.push({ type: 'text', text: '--- REFERENCE PHOTO — THE USER ---\nThis is the person who is posting. If a candidate photo contains faces, this person must be present or the photo must be excluded.' });
    imageContent.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${userFaceB64}`, detail: 'high' } });
    imageContent.push({ type: 'text', text: '--- END REFERENCE — CANDIDATE PHOTOS FOLLOW ---' });
  }

  for (let i = 0; i < photos.length; i++) {
    imageContent.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${photos[i]}`, detail: 'low' } });
    const meta = photoMetadata?.[i];
    const tags = [
      meta?.shot_type ? `[${meta.shot_type.toUpperCase()}]` : '',
      meta?.group_size && meta.group_size !== 'none' ? `[${meta.group_size.toUpperCase()}]` : '',
      favoriteIndices?.includes(i) ? '[♥ FAVORITED]' : '',
    ].filter(Boolean).join(' ');
    imageContent.push({ type: 'text', text: `Photo ${i}: ${names[i] ?? `photo_${i}`}${tags ? ` ${tags}` : ''}` });
  }

  if (faceProfiles && faceProfiles.length > 0) {
    imageContent.push({ type: 'text', text: '\n--- Face profiles ---' });
    for (const fp of faceProfiles) {
      imageContent.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${fp.samplePhotoB64}`, detail: 'low' } });
      imageContent.push({ type: 'text', text: `Person named: ${fp.name}` });
    }
  }

  const systemPrompt = buildSystemPrompt(photos.length, maxSelect, vibe, faceProfiles, favoriteIndices, contentMix, persona, !!userFaceB64);

  const response = await client.chat.completions.create(
    {
      model: OPENAI_VISION_MODEL,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: imageContent },
      ],
    },
    { timeout: 90000 },
  );

  const finishReason = response.choices[0]?.finish_reason;
  if (finishReason === 'content_filter') {
    throw new Error('GPT-4o content filter triggered — try Claude instead');
  }
  if (finishReason === 'length') {
    throw new Error('GPT-4o hit max_tokens limit — response truncated, try with fewer photos');
  }

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error(`GPT-4o returned empty content (finish_reason: ${finishReason ?? 'unknown'})`);
  }
  return parseAiResponse(text);
}

// ── Role assignment ───────────────────────────────────────────────────────────

export async function assignRolesWithClaude(
  photos: string[],
  names: string[],
  vibe?: string,
  storyHint?: string,
  persona?: string,
): Promise<AssignRolesResult> {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const content: Anthropic.MessageParam['content'] = [];

  for (let i = 0; i < photos.length; i++) {
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photos[i] } });
    content.push({ type: 'text', text: `Photo ${i}: ${names[i] ?? `photo_${i}`}` });
  }
  content.push({ type: 'text', text: buildRolePrompt(photos.length, vibe, storyHint, persona) });

  const response = await client.messages.create({
    model: CLAUDE_VISION_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content }],
  });

  const raw = (response.content[0] as Anthropic.TextBlock).text;
  return parseRoleResponse(raw, photos.length);
}

export async function assignRolesWithOpenAI(
  photos: string[],
  names: string[],
  vibe?: string,
  storyHint?: string,
  persona?: string,
): Promise<AssignRolesResult> {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const content: OpenAI.Chat.ChatCompletionContentPart[] = [];

  for (let i = 0; i < photos.length; i++) {
    content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${photos[i]}`, detail: 'low' } });
    content.push({ type: 'text', text: `Photo ${i}: ${names[i] ?? `photo_${i}`}` });
  }
  content.push({ type: 'text', text: buildRolePrompt(photos.length, vibe, storyHint, persona) });

  const response = await client.chat.completions.create({
    model: OPENAI_VISION_MODEL,
    max_tokens: 1024,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content }],
  });

  if (response.choices[0]?.finish_reason === 'content_filter') {
    throw new Error('GPT-4o content filter triggered on role assignment — try Claude instead');
  }

  const raw = response.choices[0]?.message?.content ?? '{}';
  return parseRoleResponse(raw, photos.length);
}
