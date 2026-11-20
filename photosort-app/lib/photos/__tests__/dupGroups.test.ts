import { DUP_DISTANCE_THRESHOLD, buildDupGroups, groupLabel } from '../dupGroups';
import { pHashDistance } from '../dedup';

/** A photo stub carrying only what grouping needs. */
const p = (localUri: string, phash?: string) => ({ localUri, phash });

/** Group label for a uri, or undefined when ungrouped. */
const labelOf = (groups: Map<string, string>, uri: string) => groups.get(uri);

/** All uris sharing a label, sorted. */
function membersOf(groups: Map<string, string>, label: string): string[] {
  return [...groups.entries()].filter(([, l]) => l === label).map(([u]) => u).sort();
}

describe('groupLabel', () => {
  it.each([
    [0, 'A'], [1, 'B'], [25, 'Z'],
    [26, 'AA'], [27, 'AB'], [51, 'AZ'],
    [52, 'BA'], [701, 'ZZ'], [702, 'AAA'],
  ])('maps index %p to %s', (index, expected) => {
    expect(groupLabel(index)).toBe(expected);
  });

  it('never emits a non-letter, unlike the previous char-code arithmetic', () => {
    // String.fromCharCode(65 + 26) is '[' — reachable with 30 candidates.
    for (let i = 0; i < 200; i++) {
      expect(groupLabel(i)).toMatch(/^[A-Z]+$/);
    }
  });

  it('produces a unique label for every index', () => {
    const seen = new Set(Array.from({ length: 200 }, (_, i) => groupLabel(i)));
    expect(seen.size).toBe(200);
  });
});

describe('the reported counterexample', () => {
  // Hashes 0000 / ffff / 0fff / 003f. Distances within threshold:
  //   (0,3) = 6, (1,2) = 4, (2,3) = 6
  // so all four are one connected component. The old endpoint-relabelling
  // produced A B B B, leaving photos 0 and 3 in different groups despite
  // being 6 apart.
  const photos = [p('a', '0000'), p('b', 'ffff'), p('c', '0fff'), p('d', '003f')];

  it('has the distances the report describes', () => {
    expect(pHashDistance('0000', '003f')).toBe(6);
    expect(pHashDistance('ffff', '0fff')).toBe(4);
    expect(pHashDistance('0fff', '003f')).toBe(6);
    expect(pHashDistance('0000', 'ffff')).toBe(16);
  });

  it('puts all four in one group', () => {
    const groups = buildDupGroups(photos);

    expect(new Set(groups.values()).size).toBe(1);
    expect(membersOf(groups, 'A')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('gives the two bridged photos the same label', () => {
    const groups = buildDupGroups(photos);

    expect(labelOf(groups, 'a')).toBe(labelOf(groups, 'd'));
  });
});

describe('merging connected components', () => {
  it('merges two groups when a later pair bridges them', () => {
    // a~b and c~d form separate groups; b~c then joins all four.
    const groups = buildDupGroups([
      p('a', '0000'), p('b', '0001'), p('c', '0003'), p('d', '0007'),
    ]);

    expect(new Set(groups.values()).size).toBe(1);
  });

  it('keeps genuinely separate groups separate', () => {
    const groups = buildDupGroups([
      p('a', '0000'), p('b', '0001'),   // near each other
      p('c', 'ffff'), p('d', 'fffe'),   // near each other, far from a/b
    ]);

    expect(new Set(groups.values()).size).toBe(2);
    expect(labelOf(groups, 'a')).toBe(labelOf(groups, 'b'));
    expect(labelOf(groups, 'c')).toBe(labelOf(groups, 'd'));
    expect(labelOf(groups, 'a')).not.toBe(labelOf(groups, 'c'));
  });

  it('groups a transitive chain even when the ends are far apart', () => {
    // Each step is within threshold; first and last are not. "Same scene"
    // is transitive, so the whole chain is one group.
    const chain = [
      p('a', '00000000'), p('b', '00000003'), p('c', '0000003f'),
      p('d', '000003ff'), p('e', '00003fff'),
    ];
    expect(pHashDistance('00000000', '00003fff')).toBeGreaterThan(DUP_DISTANCE_THRESHOLD);

    const groups = buildDupGroups(chain);

    expect(new Set(groups.values()).size).toBe(1);
    expect(groups.size).toBe(5);
  });

  it('is order independent', () => {
    const photos = [p('a', '0000'), p('b', 'ffff'), p('c', '0fff'), p('d', '003f')];
    const forward = buildDupGroups(photos);
    const reversed = buildDupGroups([...photos].reverse());

    const sameGroup = (g: Map<string, string>, x: string, y: string) =>
      g.get(x) !== undefined && g.get(x) === g.get(y);

    for (const [x, y] of [['a', 'b'], ['a', 'c'], ['a', 'd'], ['b', 'c']]) {
      expect(sameGroup(forward, x, y)).toBe(sameGroup(reversed, x, y));
    }
  });
});

describe('ungrouped photos', () => {
  it('omits a photo with no near-duplicate', () => {
    const groups = buildDupGroups([p('a', '0000'), p('b', 'ffff')]);

    expect(groups.size).toBe(0);
  });

  it('omits photos with no hash at all', () => {
    const groups = buildDupGroups([p('a'), p('b'), p('c')]);

    expect(groups.size).toBe(0);
  });

  it('treats a missing hash as matching nothing, even against itself', () => {
    // pHashDistance returns Infinity for a missing hash, so an unscored photo
    // must never be grouped — we have no evidence either way.
    const groups = buildDupGroups([p('a'), p('b', '0000'), p('c', '0000')]);

    expect(labelOf(groups, 'a')).toBeUndefined();
    expect(labelOf(groups, 'b')).toBe(labelOf(groups, 'c'));
  });

  it('ignores hashes of differing length rather than guessing', () => {
    const groups = buildDupGroups([p('a', '0000'), p('b', '00000000')]);

    expect(groups.size).toBe(0);
  });
});

describe('labelling', () => {
  it('assigns A to the group appearing first in candidate order', () => {
    const groups = buildDupGroups([
      p('first', '0000'), p('other', 'ffff'),
      p('firstPair', '0001'), p('otherPair', 'fffe'),
    ]);

    expect(labelOf(groups, 'first')).toBe('A');
    expect(labelOf(groups, 'other')).toBe('B');
  });

  it('labels more than 26 groups without running off the alphabet', () => {
    // 27 disjoint pairs; the 27th must be "AA", not "[".
    //
    // Each group repeats one byte across all 8 bytes, so two groups differ by
    // 8 x popcount(i ^ j) >= 8 bits — comfortably outside the threshold, while
    // the two members of a pair are identical.
    const photos = Array.from({ length: 27 }, (_, i) => {
      const hash = i.toString(16).padStart(2, '0').repeat(8);
      return [p(`x${i}`, hash), p(`y${i}`, hash)];
    }).flat();

    const groups = buildDupGroups(photos);
    const labels = new Set(groups.values());

    expect(labels.size).toBeGreaterThan(26);
    for (const label of labels) expect(label).toMatch(/^[A-Z]+$/);
  });

  it('gives every member of a group the same label', () => {
    const groups = buildDupGroups([
      p('a', '0000'), p('b', '0001'), p('c', '0003'),
    ]);

    expect(new Set([groups.get('a'), groups.get('b'), groups.get('c')]).size).toBe(1);
  });
});

describe('threshold', () => {
  it('groups a pair exactly at the threshold', () => {
    expect(pHashDistance('0000', '003f')).toBe(DUP_DISTANCE_THRESHOLD);

    expect(buildDupGroups([p('a', '0000'), p('b', '003f')]).size).toBe(2);
  });

  it('does not group a pair one bit beyond it', () => {
    expect(pHashDistance('0000', '007f')).toBe(DUP_DISTANCE_THRESHOLD + 1);

    expect(buildDupGroups([p('a', '0000'), p('b', '007f')]).size).toBe(0);
  });

  it('honours a caller-supplied threshold', () => {
    const photos = [p('a', '0000'), p('b', '007f')];

    expect(buildDupGroups(photos, 7).size).toBe(2);
    expect(buildDupGroups(photos, 0).size).toBe(0);
  });
});

describe('edge cases', () => {
  it('handles an empty candidate list', () => {
    expect(buildDupGroups([]).size).toBe(0);
  });

  it('handles a single photo', () => {
    expect(buildDupGroups([p('a', '0000')]).size).toBe(0);
  });

  it('groups identical hashes', () => {
    const groups = buildDupGroups([p('a', 'abcd'), p('b', 'abcd'), p('c', 'abcd')]);

    expect(groups.size).toBe(3);
    expect(new Set(groups.values()).size).toBe(1);
  });

  it('scales to a full candidate pool without quadratic label churn', () => {
    const photos = Array.from({ length: 30 }, (_, i) =>
      p(`p${i}`, (i % 15).toString(16).repeat(8).slice(0, 8)),
    );

    const groups = buildDupGroups(photos);

    // Every grouped photo's label must be shared by at least one other.
    for (const [uri, label] of groups) {
      expect(membersOf(groups, label).filter((u) => u !== uri).length).toBeGreaterThan(0);
    }
  });
});
