import type { ConfidenceLevel, RightsProfile } from '../../schemas';
import type { ContributionTerms } from '../../schemas/utdg';

/**
 * Deterministic rights ladder for staged UTDG export (rights matrix §7).
 * LLMs never call this with a guessed commercial flag — only this module may
 * set commercialAllowed true, and only when source rights are explicit.
 */

export interface RightsContext {
  /** Upstream license label (CC0, CC BY, Institution Terms, Unknown, …). */
  sourceRights?: string;
  contributionTerms?: ContributionTerms;
  /** When true, treat material as private notes regardless of source label. */
  privateSource?: boolean;
}

export interface ResolvedRights {
  rightsProfile: RightsProfile;
  sourceRights: string;
  contributionTerms: ContributionTerms;
  rightsConfidence: ConfidenceLevel;
  commercialAllowed: boolean;
  /** Prefer needs_review when rights are unknown or private. */
  reviewStatus: 'draft' | 'staged' | 'needs_review';
}

/** Intersect permissions; a permissive package label cannot erase a source restriction. */
export function intersectRightsProfiles(profiles: readonly RightsProfile[]): RightsProfile {
  for (const profile of ['restricted', 'unknown', 'reference-only', 'non-commercial', 'attribution-required'] as const) {
    if (profiles.includes(profile)) return profile;
  }
  return profiles.length > 0 && profiles.every((profile) => profile === 'public-domain')
    ? 'public-domain'
    : 'unrestricted';
}

export function permitsCommercialUse(profile: RightsProfile): boolean {
  return profile === 'public-domain' || profile === 'unrestricted' || profile === 'attribution-required';
}

function normalizeSourceRights(raw: string | undefined): string {
  const t = (raw ?? 'Unknown').trim();
  return t.length > 0 ? t : 'Unknown';
}

/**
 * Map a free-form source-rights label to a platform rightsProfile.
 * Conservative: anything unclear becomes reference-only or unknown.
 */
export function resolveRights(ctx: RightsContext = {}): ResolvedRights {
  const sourceRights = normalizeSourceRights(ctx.sourceRights);
  const contributionTerms = ctx.contributionTerms ?? 'private-only';
  const lower = sourceRights.toLowerCase();

  if (ctx.privateSource === true || contributionTerms === 'private-only' && lower === 'private') {
    return {
      rightsProfile: 'restricted',
      sourceRights,
      contributionTerms: 'private-only',
      rightsConfidence: 'high',
      commercialAllowed: false,
      reviewStatus: 'needs_review'
    };
  }

  if (lower === 'unknown' || lower === '') {
    return {
      rightsProfile: 'unknown',
      sourceRights: 'Unknown',
      contributionTerms,
      rightsConfidence: 'low',
      commercialAllowed: false,
      reviewStatus: 'needs_review'
    };
  }

  // Local fixtures / institution-restricted enriched paraphrases
  if (
    lower.includes('fixture')
    || lower.includes('institution')
    || lower.includes('in copyright')
    || lower === 'reference-only'
  ) {
    return {
      rightsProfile: 'reference-only',
      sourceRights,
      contributionTerms,
      rightsConfidence: lower.includes('fixture') ? 'high' : 'medium',
      commercialAllowed: false,
      reviewStatus: 'staged'
    };
  }

  if (lower.includes('nc') || lower.includes('non-commercial') || lower.includes('noncommercial')) {
    return {
      rightsProfile: 'non-commercial',
      sourceRights,
      contributionTerms,
      rightsConfidence: 'medium',
      commercialAllowed: false,
      reviewStatus: 'staged'
    };
  }

  if (
    lower.includes('odc-by')
    || lower.includes('cc by')
    || lower === 'cc-by'
    || lower.includes('attribution')
  ) {
    return {
      rightsProfile: 'attribution-required',
      sourceRights,
      contributionTerms,
      rightsConfidence: 'medium',
      commercialAllowed: contributionTerms !== 'private-only',
      reviewStatus: contributionTerms === 'private-only' ? 'needs_review' : 'staged'
    };
  }

  if (lower.includes('cc0') || lower.includes('public domain') || lower.includes('public-domain')) {
    return {
      rightsProfile: lower.includes('public') ? 'public-domain' : 'unrestricted',
      sourceRights,
      contributionTerms,
      rightsConfidence: 'high',
      commercialAllowed: contributionTerms !== 'private-only',
      reviewStatus: contributionTerms === 'private-only' ? 'needs_review' : 'staged'
    };
  }

  // Default for research paste / synthesis with a named but non-open license
  return {
    rightsProfile: 'reference-only',
    sourceRights,
    contributionTerms,
    rightsConfidence: 'low',
    commercialAllowed: false,
    reviewStatus: 'staged'
  };
}

/** Product default for ordinary research-parse contribution with no license stated. */
export function defaultResearchParseRights(): ResolvedRights {
  return resolveRights({ sourceRights: 'Unknown', contributionTerms: 'private-only' });
}
