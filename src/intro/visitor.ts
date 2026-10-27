/**
 * The name the visitor gave at the gate, carried into the world. It lives in
 * localStorage, so a returning visitor is greeted by name and not asked again
 * until they clear the site's data. Which experience to open onto is still
 * asked every visit (see experience.ts); only the name is remembered.
 */

const KEY = 'zoom:visitor';

/** What the panels call someone who went in without giving a name. */
export const UNNAMED = 'traveler';

/** The remembered name, or null if the visitor has never given one. */
export function storedVisitor(): string | null {
  try {
    // Names given before this moved to localStorage were kept for the session only.
    return localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

export function visitorName(): string {
  return storedVisitor() ?? UNNAMED;
}

export function saveVisitor(name: string): void {
  try {
    localStorage.setItem(KEY, name);
  } catch {
    /* storage blocked: the name still reaches the panels already on the page */
  }
  fillVisitor(name);
}

/** Writes the name into every `[data-visitor]` slot rendered into the world. */
export function fillVisitor(name = visitorName()): void {
  document.querySelectorAll<HTMLElement>('[data-visitor]').forEach((el) => (el.textContent = name));
}
