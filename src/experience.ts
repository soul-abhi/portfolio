/**
 * The two readings of the portfolio. Design is the zoomable night surface;
 * Content is the light page that scrolls. The visitor picks one at the gate.
 *
 * The choice lives in sessionStorage, like the gate's own memory, so a reload
 * lands where they chose and a new visit asks again. `?view=design` or
 * `?view=content` overrides it, so either one can be linked to directly.
 */

export type Experience = 'design' | 'content';

const KEY = 'zoom:experience';

function isExperience(v: unknown): v is Experience {
  return v === 'design' || v === 'content';
}

export function storedExperience(): Experience | null {
  const asked = new URLSearchParams(location.search).get('view');
  if (isExperience(asked)) {
    saveExperience(asked);
    return asked;
  }
  try {
    const v = sessionStorage.getItem(KEY);
    return isExperience(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveExperience(e: Experience): void {
  try {
    sessionStorage.setItem(KEY, e);
  } catch {
    /* private mode: the choice holds for this page only */
  }
}

/** Leaves for the other experience. A plain reload, without any `?view=` that would override the choice. */
export function switchExperience(e: Experience): void {
  saveExperience(e);
  location.replace(location.pathname);
}
