import { txEnv } from '@core/globalData';

export const RESOURCE_BACKUPS_DIR = 'resource-backups';

/**
 * Resource backups live in the profile data folder, next to the other panel data files:
 * `<profile>/data/resource-backups/<resource>/<timestamp>_<version>/`.
 */
export const getResourceBackupsRoot = () => txEnv.profileSubPath('data', RESOURCE_BACKUPS_DIR);
