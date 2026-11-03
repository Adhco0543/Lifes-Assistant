import type { PolicySettings } from './tools/policy';

export function canRunRadarSweep(settings: PolicySettings & { backgroundMode?: boolean }): boolean {
  return settings.backgroundMode === true;
}
