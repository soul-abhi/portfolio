import { isDiveMode } from './core/input';
import { storedExperience } from './experience';

/**
 * Two experiences share one entry. The zoomable surface (main) owns the gate,
 * and the gate is where a first-time visitor chooses; a visitor who already
 * chose Content goes straight to it, and so does every phone, since the
 * surface has no phone layout. Both are imported dynamically, so neither
 * one's code or assets reach a visitor who is reading the other.
 */
if (isDiveMode() || storedExperience() === 'content') {
  void import('./content').then((m) => m.mountContent({ entrance: 'load' }));
} else {
  void import('./main');
}
