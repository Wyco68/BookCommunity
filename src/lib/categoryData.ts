import type { CategoryMember, SessionCategory } from '../types'

export function buildCategoryMembershipLookup(
  members: CategoryMember[],
): Record<string, CategoryMember> {
  const lookup: Record<string, CategoryMember> = {}
  for (const member of members) {
    lookup[member.category_id] = member
  }
  return lookup
}

export function buildSessionCategoryLookup(
  sessionCategories: SessionCategory[],
): Record<string, string[]> {
  const lookup: Record<string, string[]> = {}
  for (const sc of sessionCategories) {
    if (!lookup[sc.session_id]) {
      lookup[sc.session_id] = []
    }
    lookup[sc.session_id].push(sc.category_id)
  }
  return lookup
}

export function buildCategorySessionLookup(
  sessionCategories: SessionCategory[],
): Record<string, string[]> {
  const lookup: Record<string, string[]> = {}
  for (const sc of sessionCategories) {
    if (!lookup[sc.category_id]) {
      lookup[sc.category_id] = []
    }
    lookup[sc.category_id].push(sc.session_id)
  }
  return lookup
}

export function filterSessionsByCategory(
  sessionCategories: SessionCategory[],
  categoryIds: string[],
): Set<string> {
  const categorySet = new Set(categoryIds)
  const sessionIds = new Set<string>()

  for (const sc of sessionCategories) {
    if (categorySet.has(sc.category_id)) {
      sessionIds.add(sc.session_id)
    }
  }

  return sessionIds
}
