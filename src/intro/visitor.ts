/**
 * The name the visitor gave at the gate, carried into the world. It lives in
 * sessionStorage because the gate skips its question on a revisit within the
 * same session, and the greeting should still know who it is talking to.
 */

const KEY = 'zoom:visitor';

/** What the panels call someone who went in without giving a name. */
export const UNNAMED = 'traveler';

export function visitorName(): string {
  try {
    return sessionStorage.getItem(KEY) || UNNAMED;
  } catch {
    return UNNAMED;
  }
}

export function saveVisitor(name: string): void {
  try {
    sessionStorage.setItem(KEY, name);
  } catch {
    /* private mode: the name still reaches the panels already on the page */
  }
  fillVisitor(name);
}

/** Writes the name into every `[data-visitor]` slot rendered into the world. */
export function fillVisitor(name = visitorName()): void {
  document.querySelectorAll<HTMLElement>('[data-visitor]').forEach((el) => (el.textContent = name));
}
