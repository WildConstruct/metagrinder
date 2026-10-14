/**
 * Stable UTDG ID minting. Convention: utdg:{kind}:{slug}
 * Kind segment must match /^[a-z-]+$/ so the candidate schema regex accepts it.
 * Local ids may contain underscores, colons, and digits; they are normalized.
 */

export type UtdgIdKind =
  | 'source'
  | 'evidence'
  | 'concept'
  | 'archetype'
  | 'rule'
  | 'image';

/** Collapse free-form local ids into a stable, lowercase slug. */
export function slugifyLocalId(localId: string): string {
  const slug = localId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-:]+|[-:]+$/g, '');
  return slug.length > 0 ? slug : 'unnamed';
}

export function toUtdgId(kind: UtdgIdKind, localId: string): string {
  return `utdg:${kind}:${slugifyLocalId(localId)}`;
}
