/**
 * Tests for the two AI-curation HTTP calls.
 *
 * Both carry their own timeout: without one, a backend that accepts the
 * connection and then goes away leaves the processing screen or the review
 * screen spinning forever (audit O6).
 */
import {
  ASSIGN_ROLES_TIMEOUT_MS,
  assignRoles,
  curateDevicePhotos,
} from '../curate';

const URL = 'http://backend.test:8000';

const CURATE_ARGS = {
  photosBase64: ['aaa', 'bbb'],
  photoNames: ['a.jpg', 'b.jpg'],
  provider: 'openai' as const,
  backendUrl: URL,
};

const ROLES_ARGS = {
  photosBase64: ['aaa', 'bbb'],
  photoNames: ['a.jpg', 'b.jpg'],
  provider: 'openai' as const,
  backendUrl: URL,
};

/** Resolve with a JSON body. */
function mockJson(body: unknown) {
  const fn = jest.fn(async () => ({ ok: true, status: 200, json: async () => body }));
  (global as any).fetch = fn;
  return fn;
}

/** Never resolve; reject on abort, immediately if already aborted. */
function mockAbortable() {
  const fn = jest.fn(
    (_url: string, init: any) =>
      new Promise((_resolve, reject) => {
        const fail = () => {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        };
        if (init?.signal?.aborted) {
          fail();
          return;
        }
        init?.signal?.addEventListener('abort', fail);
      }),
  );
  (global as any).fetch = fn;
  return fn;
}

beforeEach(() => {
  (global as any).fetch = jest.fn();
});

describe('curateDevicePhotos', () => {
  it('posts to the curation endpoint and returns the parsed body', async () => {
    const fetchMock = mockJson({ success: true, selected_indices: [0, 1] });

    const result = await curateDevicePhotos(CURATE_ARGS);

    expect(fetchMock).toHaveBeenCalledWith(
      `${URL}/api/curate_device_photos`,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result).toEqual({ success: true, selected_indices: [0, 1] });
  });

  it('maps camelCase arguments onto the snake_case wire format', async () => {
    const fetchMock = mockJson({ success: true });

    await curateDevicePhotos({
      ...CURATE_ARGS,
      favoriteIndices: [1],
      vibe: 'a long weekend',
      maxSelect: 8,
      contentMix: 'people',
      persona: 'social',
      userFaceB64: 'face',
      photoMetadata: [{ shot_type: 'wide', quality: 0.7 }],
    });

    const body = JSON.parse((fetchMock.mock.calls[0] as any[])[1].body);
    expect(body).toMatchObject({
      photos_b64: ['aaa', 'bbb'],
      photo_names: ['a.jpg', 'b.jpg'],
      favorite_indices: [1],
      vibe: 'a long weekend',
      max_select: 8,
      content_mix: 'people',
      persona: 'social',
      user_face_b64: 'face',
      photo_metadata: [{ shot_type: 'wide', quality: 0.7 }],
    });
  });

  it('defaults max_select to the carousel limit', async () => {
    const fetchMock = mockJson({ success: true });

    await curateDevicePhotos(CURATE_ARGS);

    expect(JSON.parse((fetchMock.mock.calls[0] as any[])[1].body).max_select).toBe(10);
  });

  it('aborts when the caller signals', async () => {
    const caller = new AbortController();
    mockAbortable();

    const pending = curateDevicePhotos({ ...CURATE_ARGS, signal: caller.signal });
    caller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('propagates a backend error body rather than throwing', async () => {
    mockJson({ success: false, error: 'ANTHROPIC_API_KEY not set on the backend.' });

    const result = await curateDevicePhotos({ ...CURATE_ARGS, provider: 'claude' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('ANTHROPIC_API_KEY');
  });
});

describe('assignRoles', () => {
  it('uses a 60s budget — shorter than curation, since it fires on every edit', () => {
    expect(ASSIGN_ROLES_TIMEOUT_MS).toBe(60_000);
  });

  it('posts to the role endpoint and returns the parsed body', async () => {
    const fetchMock = mockJson({ success: true, ordering: [1, 0] });

    const result = await assignRoles(ROLES_ARGS);

    expect(fetchMock).toHaveBeenCalledWith(
      `${URL}/api/assign_roles`,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result).toEqual({ success: true, ordering: [1, 0] });
  });

  it('forwards the narrative context the prompt depends on', async () => {
    const fetchMock = mockJson({ success: true });

    await assignRoles({
      ...ROLES_ARGS,
      vibe: 'three days in Lisbon',
      story: 'from the tram to the coast',
      persona: 'storyteller',
    });

    const body = JSON.parse((fetchMock.mock.calls[0] as any[])[1].body);
    expect(body).toMatchObject({
      vibe: 'three days in Lisbon',
      story: 'from the tram to the coast',
      persona: 'storyteller',
      provider: 'openai',
    });
  });

  it('always attaches an abort signal, even with no caller signal', async () => {
    const fetchMock = mockJson({ success: true });

    await assignRoles(ROLES_ARGS);

    expect((fetchMock.mock.calls[0] as any[])[1].signal).toBeDefined();
  });

  it('aborts once its own timeout elapses (audit O6)', async () => {
    mockAbortable();

    await expect(assignRoles({ ...ROLES_ARGS, timeoutMs: 10 })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('aborts when the caller signals', async () => {
    const caller = new AbortController();
    mockAbortable();

    const pending = assignRoles({ ...ROLES_ARGS, signal: caller.signal });
    caller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects immediately when handed an already-aborted signal', async () => {
    const caller = new AbortController();
    caller.abort();
    const fetchMock = mockAbortable();

    await expect(
      assignRoles({ ...ROLES_ARGS, signal: caller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    // fetch is still called, but with a signal that is already aborted.
    expect((fetchMock.mock.calls[0] as any[])[1].signal.aborted).toBe(true);
  });

  it('clears its timer on the success path so no handle is left pending', async () => {
    const clearSpy = jest.spyOn(global, 'clearTimeout');
    mockJson({ success: true });

    await assignRoles(ROLES_ARGS);

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('clears its timer on the failure path too', async () => {
    const clearSpy = jest.spyOn(global, 'clearTimeout');
    (global as any).fetch = jest.fn(async () => {
      throw new Error('network down');
    });

    await expect(assignRoles(ROLES_ARGS)).rejects.toThrow('network down');

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
