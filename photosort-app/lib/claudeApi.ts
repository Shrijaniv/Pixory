import { Caption, LocalPhoto } from './store';
import { photoToBase64 } from './photoLibrary';

const CLAUDE_API = 'https://api.anthropic.com/v1/messages';
const MAX_IMAGES_PER_CALL = 16; // keep payload manageable

export interface CurationResult {
  selectedIndices: number[];   // indices into the photos array passed in
  captions: Caption[];
  notes: string;
}

/**
 * Send a batch of photos to Claude and ask it to select the best ones
 * and write 4 caption variants.
 */
export async function curateWithClaude(
  photos: LocalPhoto[],
  options: {
    apiKey: string;
    vibe?: string;
    maxSelect?: number;
    onProgress?: (msg: string) => void;
  },
): Promise<CurationResult> {
  const { apiKey, vibe, maxSelect = 20, onProgress } = options;

  // Limit to manageable batch
  const batch = photos.slice(0, MAX_IMAGES_PER_CALL);
  onProgress?.(`Sending ${batch.length} photos to Claude...`);

  // Build content blocks
  const content: any[] = [];

  for (let i = 0; i < batch.length; i++) {
    onProgress?.(`Encoding photo ${i + 1}/${batch.length}...`);
    const base64 = await photoToBase64(batch[i].localUri);
    const ext = batch[i].filename.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mediaType = ext === 'png' ? 'image/png' : 'image/jpeg';

    content.push({
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: base64 },
    });
    content.push({
      type: 'text',
      text: `Photo ${i + 1}: ${batch[i].filename} (${batch[i].width}×${batch[i].height})`,
    });
  }

  const vibeText = vibe ? `\n\nThe user wants photos with this vibe/theme: "${vibe}".` : '';

  content.push({
    type: 'text',
    text: `You are a professional Instagram curator. You have been shown ${batch.length} photos above.${vibeText}

Select the best ${Math.min(maxSelect, batch.length)} photos for an Instagram carousel post. Consider:
- Technical quality (sharpness, exposure, composition)
- Visual variety and storytelling flow
- Avoiding near-duplicates

Then write exactly 4 caption variants.

Respond with valid JSON only, no markdown:
{
  "selected_indices": [0, 2, 5, ...],
  "notes": "Brief explanation of your selection",
  "captions": [
    {"mood": "wanderlust", "text": "...", "hashtags": ["tag1", "tag2"]},
    {"mood": "minimal", "text": "...", "hashtags": ["tag1"]},
    {"mood": "story", "text": "...", "hashtags": ["tag1", "tag2"]},
    {"mood": "playful", "text": "...", "hashtags": ["tag1", "tag2"]}
  ]
}`,
  });

  onProgress?.('Claude is analyzing your photos...');

  const res = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? '';

  try {
    const parsed = JSON.parse(text);
    return {
      selectedIndices: parsed.selected_indices ?? [],
      captions: parsed.captions ?? [],
      notes: parsed.notes ?? '',
    };
  } catch {
    throw new Error('Claude returned malformed JSON. Try again.');
  }
}

/** Same as above but using OpenAI GPT-4o. */
export async function curateWithOpenAI(
  photos: LocalPhoto[],
  options: {
    apiKey: string;
    vibe?: string;
    maxSelect?: number;
    onProgress?: (msg: string) => void;
  },
): Promise<CurationResult> {
  const { apiKey, vibe, maxSelect = 20, onProgress } = options;

  const batch = photos.slice(0, MAX_IMAGES_PER_CALL);
  onProgress?.(`Sending ${batch.length} photos to GPT-4o...`);

  const imageContent: any[] = [];

  for (let i = 0; i < batch.length; i++) {
    onProgress?.(`Encoding photo ${i + 1}/${batch.length}...`);
    const base64 = await photoToBase64(batch[i].localUri);
    const ext = batch[i].filename.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mediaType = ext === 'png' ? 'image/png' : 'image/jpeg';

    imageContent.push({
      type: 'image_url',
      image_url: { url: `data:${mediaType};base64,${base64}`, detail: 'low' },
    });
  }

  const vibeText = vibe ? `\n\nVibe/theme: "${vibe}".` : '';
  imageContent.push({
    type: 'text',
    text: `You are a professional Instagram curator. You have been shown ${batch.length} photos (in order).${vibeText}

Select the best ${Math.min(maxSelect, batch.length)} for an Instagram carousel. Write 4 caption variants.

Respond with valid JSON only:
{
  "selected_indices": [0, 2, ...],
  "notes": "...",
  "captions": [
    {"mood": "wanderlust", "text": "...", "hashtags": [...]},
    {"mood": "minimal", "text": "...", "hashtags": [...]},
    {"mood": "story", "text": "...", "hashtags": [...]},
    {"mood": "playful", "text": "...", "hashtags": [...]}
  ]
}`,
  });

  onProgress?.('GPT-4o is analyzing your photos...');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 2048,
      messages: [{ role: 'user', content: imageContent }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '';

  try {
    const parsed = JSON.parse(text);
    return {
      selectedIndices: parsed.selected_indices ?? [],
      captions: parsed.captions ?? [],
      notes: parsed.notes ?? '',
    };
  } catch {
    throw new Error('GPT-4o returned malformed JSON. Try again.');
  }
}
