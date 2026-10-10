export const PANEL_ROLES = ["admin", "pengurus", "bendahara", "konten"] as const;
export const FINANCE_ROLES = ["admin", "bendahara"] as const;
export const CONTENT_ROLES = ["admin", "pengurus", "konten"] as const;

export function canFinance(role: string | null | undefined) {
  return !!role && (FINANCE_ROLES as readonly string[]).includes(role);
}

export function canContent(role: string | null | undefined) {
  return !!role && (CONTENT_ROLES as readonly string[]).includes(role);
}
