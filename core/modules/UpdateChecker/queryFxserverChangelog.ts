const modulename = 'UpdateChecker';
import { z } from 'zod';
import { fromError } from 'zod-validation-error';
import got from '@lib/got';
import { txEnv } from '@core/globalData';
import consoleFactory from '@lib/console';
import type { UpdateDataType } from '@shared/otherTypes';
const console = consoleFactory(modulename);


//Cfx.re publishes the artifact recommendations here, it is not tied to any panel version
const changelogRespSchema = z.object({
    recommended: z.coerce.number().positive(),
    optional: z.coerce.number().positive(),
    critical: z.coerce.number().positive(),
});

const artifactsPageUrl = (isWindows: boolean) => isWindows
    ? 'https://runtime.fivem.net/artifacts/fivem/build_server_windows/master/'
    : 'https://runtime.fivem.net/artifacts/fivem/build_proot_linux/master/';

export type FxsChangelogResult = { success: true, update?: UpdateDataType } | { success: false };


/**
 * Checks the running FXServer build against the Cfx.re recommendations.
 * Anything below the recommended build is important, an optional build is not.
 */
export const queryFxserverChangelog = async (): Promise<FxsChangelogResult> => {
    let apiResponse: z.infer<typeof changelogRespSchema>;
    try {
        //perform request - cache busting every ~1.4h
        const osTypeApiUrl = (txEnv.isWindows) ? 'win32' : 'linux';
        const cacheBuster = Math.floor(Date.now() / 5_000_000);
        const reqUrl = `https://changelogs-live.fivem.net/api/changelog/versions/${osTypeApiUrl}/server?${cacheBuster}`;
        const resp = await got(reqUrl).json();
        apiResponse = changelogRespSchema.parse(resp);
    } catch (error) {
        let msg = (error as Error).message;
        if (error instanceof z.ZodError) {
            msg = fromError(error, { prefix: null }).message;
        }
        console.verbose.warn(`Failed to retrieve FXServer update data with error: ${msg}`);
        return { success: false };
    }

    const url = artifactsPageUrl(txEnv.isWindows);
    if (txEnv.fxsVersion < apiResponse.critical) {
        //A critical build can be older than the recommended one, always point at the newest
        const target = Math.max(apiResponse.critical, apiResponse.recommended);
        return { success: true, update: { version: target.toString(), isImportant: true, url } };
    } else if (txEnv.fxsVersion < apiResponse.recommended) {
        return { success: true, update: { version: apiResponse.recommended.toString(), isImportant: true, url } };
    } else if (txEnv.fxsVersion < apiResponse.optional) {
        return { success: true, update: { version: apiResponse.optional.toString(), isImportant: false, url } };
    }
    return { success: true };
};
