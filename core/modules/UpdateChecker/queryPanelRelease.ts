const modulename = 'UpdateChecker';
import { z } from 'zod';
import { fromError } from 'zod-validation-error';
import got from '@lib/got';
import { txEnv } from '@core/globalData';
import consoleFactory from '@lib/console';
import { getVersionDiff } from './versionCompare';
import type { UpdateDataType } from '@shared/otherTypes';
const console = consoleFactory(modulename);


//This repository's releases are the only source of truth for panel updates
export const PANEL_REPO_SLUG = 'chyarofivem/cAdminPanel';
const releaseApiUrl = `https://api.github.com/repos/${PANEL_REPO_SLUG}/releases/latest`;

//Only the fields actually used are required, so a schema change upstream cannot break the check
const releaseRespSchema = z.object({
    tag_name: z.string().min(1),
    html_url: z.string().url(),
    draft: z.boolean().optional(),
    prerelease: z.boolean().optional(),
});

export type PanelReleaseResult = { success: true, update?: UpdateDataType } | { success: false };


/**
 * Checks this repository's latest GitHub release against the running version.
 * The /releases/latest endpoint already excludes drafts and pre-releases, but both flags
 * are checked anyway in case the endpoint behavior ever changes.
 */
export const queryPanelRelease = async (): Promise<PanelReleaseResult> => {
    let release: z.infer<typeof releaseRespSchema>;
    try {
        const resp = await got(releaseApiUrl, {
            headers: {
                accept: 'application/vnd.github+json',
                'x-github-api-version': '2022-11-28',
            },
        }).json();
        release = releaseRespSchema.parse(resp);
    } catch (error) {
        //A repository with no published release answers 404, which is expected until the
        //first release is tagged, so none of this is worth bothering the admin with.
        if ((error as any)?.response?.statusCode === 404) {
            console.verbose.debug('No published release found, skipping panel update check.');
            return { success: false };
        }
        let msg = (error as Error).message;
        if (error instanceof z.ZodError) {
            msg = fromError(error, { prefix: null }).message;
        }
        console.verbose.warn(`Failed to retrieve panel update data with error: ${msg}`);
        return { success: false };
    }

    if (release.draft || release.prerelease) return { success: true };

    const diff = getVersionDiff(txEnv.txaVersion, release.tag_name);
    if (!diff) return { success: true };
    return {
        success: true,
        update: {
            version: release.tag_name.trim().replace(/^v/i, ''),
            //Patches are the only updates that can wait
            isImportant: diff !== 'patch',
            url: release.html_url,
        },
    };
};
