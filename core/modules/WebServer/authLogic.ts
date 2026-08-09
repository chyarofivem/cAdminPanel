const modulename = 'WebServer:AuthLogic';
import { z } from "zod";
import { txEnv } from '@core/globalData';
import consoleFactory from '@lib/console';
import type { SessToolsType } from "./middlewares/sessionMws";
import { ReactAuthDataType } from "@shared/authApiTypes";
const console = consoleFactory(modulename);


/**
 * Admin class to be used as ctx.admin
 */
export class AuthedAdmin {
    public readonly name: string;
    public readonly isMaster: boolean;
    public readonly permissions: string[];
    public readonly isTempPassword: boolean;
    public readonly profilePicture: string | undefined;
    public readonly email: string | undefined;
    public readonly chyaroLinked: boolean;
    public readonly discordAvatar: string | undefined;
    public readonly discordIdentifier: string | undefined;
    public readonly cfxIdentifier: string | undefined;
    public readonly csrfToken?: string;

    constructor(vaultAdmin: any, csrfToken?: string) {
        this.name = vaultAdmin.name;
        this.isMaster = vaultAdmin.master;
        this.permissions = vaultAdmin.permissions;
        this.isTempPassword = vaultAdmin.password_temporary === true;
        this.csrfToken = csrfToken;

        const cachedPfp = txCore.cacheStore.get(`admin:picture:${vaultAdmin.name}`);
        this.profilePicture = typeof cachedPfp === 'string' ? cachedPfp : undefined;
        this.chyaroLinked = !!vaultAdmin.providers?.chyarologin;
        const chyaroData = vaultAdmin.providers?.chyarologin?.data || {};
        this.email = chyaroData.email || vaultAdmin.providers?.chyarologin?.identifier;
        //Once chyarologin is linked it is the authority for Discord identity. In
        //particular, do not surface a stale/manual provider when the verified
        //chyarologin profile has no Discord account attached.
        const discordId = this.chyaroLinked
            ? chyaroData.discordId
            : vaultAdmin.providers?.discord?.id;
        this.discordIdentifier = discordId ? `discord:${discordId}` : undefined;
        //The explicitly linked identifier wins: it is set by the admin themselves
        //in the user settings page, while fivemLicense comes from chyarologin.
        this.cfxIdentifier = vaultAdmin.providers?.citizenfx?.identifier || chyaroData.fivemLicense;
        this.discordAvatar = chyaroData.discordId && chyaroData.discordAvatar
            ? `https://cdn.discordapp.com/avatars/${chyaroData.discordId}/${chyaroData.discordAvatar}.jpg?size=128`
            : undefined;
    }

    /**
     * Logs an action to the console and the action logger
     */
    public logAction(action: string): void {
        txCore.logger.admin.write(this.name, action);
    };

    /**
     * Logs a command to the console and the action logger
     */
    public logCommand(data: string): void {
        txCore.logger.admin.write(this.name, data, 'command');
    };

    /**
     * Returns if admin has permission or not - no message is printed
     */
    hasPermission(perm: string): boolean {
        try {
            if (perm === 'master') {
                return this.isMaster;
            }
            return (
                this.isMaster
                || this.permissions.includes('all_permissions')
                || this.permissions.includes(perm)
            );
        } catch (error) {
            console.verbose.warn(`Error validating permission '${perm}' denied.`);
            return false;
        }
    }

    /**
     * Test for a permission and prints warn if test fails and verbose
     */
    testPermission(perm: string, fromCtx: string): boolean {
        if (!this.hasPermission(perm)) {
            console.verbose.warn(`[${this.name}] Permission '${perm}' denied.`, fromCtx);
            return false;
        }
        return true;
    }

    /**
     * Returns the data used for the frontend or sv_admins.lua
     */
    getAuthData(): ReactAuthDataType {
        return {
            name: this.name,
            email: this.email,
            chyaroLinked: this.chyaroLinked,
            permissions: this.isMaster ? ['all_permissions'] : this.permissions,
            isMaster: this.isMaster,
            isTempPassword: this.isTempPassword,
            profilePicture: this.profilePicture,
            discordAvatar: this.discordAvatar,
            discordIdentifier: this.discordIdentifier,
            cfxIdentifier: this.cfxIdentifier,
            csrfToken: this.csrfToken ?? 'not_set',
        }
    }
}

export type AuthedAdminType = InstanceType<typeof AuthedAdmin>;


/**
 * Return type helper - null reason indicates nothing to print
 */
type AuthLogicReturnType = {
    success: true,
    admin: AuthedAdmin;
} | {
    success: false;
    rejectReason?: string;
};
const successResp = (vaultAdmin: any, csrfToken?: string) => ({
    success: true,
    admin: new AuthedAdmin(vaultAdmin, csrfToken),
} as const)
const failResp = (reason?: string) => ({
    success: false,
    rejectReason: reason,
} as const)


/**
 * ZOD schemas for session auth
 */
const validChyaroSessAuthSchema = z.object({
    type: z.literal('chyarologin'),
    username: z.string(),
    csrfToken: z.string(),
    expiresAt: z.number(),
    identifier: z.string(),
});
export type ChyaroSessAuthType = z.infer<typeof validChyaroSessAuthSchema>;

const validPassSessAuthSchema = z.object({
    type: z.literal('password'),
    username: z.string(),
    csrfToken: z.string(),
    expiresAt: z.literal(false),
    password_hash: z.string(),
});
export type PassSessAuthType = z.infer<typeof validPassSessAuthSchema>;

const validSessAuthSchema = z.discriminatedUnion('type', [
    validChyaroSessAuthSchema,
    validPassSessAuthSchema,
]);


/**
 * Autentication logic used in both websocket and webserver, for both web and nui requests.
 */
export const checkRequestAuth = (
    reqHeader: { [key: string]: unknown },
    reqIp: string,
    isLocalRequest: boolean,
    sessTools: SessToolsType,
) => {
    return typeof reqHeader['x-txadmin-token'] === 'string'
        ? nuiAuthLogic(reqIp, isLocalRequest, reqHeader)
        : normalAuthLogic(sessTools);
}


/**
 * Autentication logic used in both websocket and webserver
 */
export const normalAuthLogic = (
    sessTools: SessToolsType
): AuthLogicReturnType => {
    try {
        // Getting session
        const sess = sessTools.get();
        if (!sess) {
            return failResp();
        }

        // Parsing session auth
        const validationResult = validSessAuthSchema.safeParse(sess?.auth);
        if (!validationResult.success) {
            return failResp();
        }
        const sessAuth = validationResult.data;

        // Checking for expiration
        if (sessAuth.expiresAt !== false && Date.now() > sessAuth.expiresAt) {
            return failResp(`Expired session from '${sess.auth?.username}'.`);
        }

        // Searching for admin in AdminStore
        const vaultAdmin = txCore.adminStore.getAdminByName(sessAuth.username);
        if (!vaultAdmin) {
            return failResp(`Admin '${sessAuth.username}' not found.`);
        }

        if (sessAuth.type === 'password') {
            if (vaultAdmin.password_hash !== sessAuth.password_hash) {
                return failResp(`Password hash doesn't match for '${sessAuth.username}'.`);
            }
        } else {
            const configuredEmail = vaultAdmin.providers.chyarologin?.identifier;
            if (configuredEmail?.toLowerCase() !== sessAuth.identifier.toLowerCase()) {
                return failResp(`chyarologin identity doesn't match for '${sessAuth.username}'.`);
            }
        }
        return successResp(vaultAdmin, sessAuth.csrfToken);
    } catch (error) {
        console.debug(`Error validating session data: ${(error as Error).message}`);
        return failResp('Error validating session data.');
    }
};


/**
 * Autentication & authorization logic used in for nui requests
 */
export const nuiAuthLogic = (
    reqIp: string,
    isLocalRequest: boolean,
    reqHeader: { [key: string]: unknown }
): AuthLogicReturnType => {
    try {
        // Check sus IPs
        if (
            !isLocalRequest
            && !txEnv.isZapHosting
            && !txConfig.webServer.disableNuiSourceCheck
        ) {
            console.verbose.warn(`NUI Auth Failed: reqIp "${reqIp}" not a local or allowed address.`);
            return failResp('Invalid Request: source');
        }

        // DEBUG
        // throw new Error('make sure you know what you are doing');
        // return successResp(new AuthedAdmin({
        //     name: 'tempadmin',
        //     master: true,
        //     permissions: ['all_permissions'],
        //     password_temporary: false,
        // }), undefined);

        // Check missing headers
        if (typeof reqHeader['x-txadmin-token'] !== 'string') {
            return failResp('Invalid Request: token header');
        }
        if (typeof reqHeader['x-txadmin-identifiers'] !== 'string') {
            return failResp('Invalid Request: identifiers header');
        }

        // Check token value
        if (reqHeader['x-txadmin-token'] !== txCore.webServer.luaComToken) {
            const expected = txCore.webServer.luaComToken;
            const censoredExpected = expected.slice(0, 6) + '...' + expected.slice(-6);
            console.verbose.warn(`NUI Auth Failed: token received '${reqHeader['x-txadmin-token']}' !== expected '${censoredExpected}'.`);
            return failResp('Unauthorized: token value');
        }

        // Check identifier array
        const identifiers = reqHeader['x-txadmin-identifiers']
            .split(',')
            .filter((i) => i.length);
        if (!identifiers.length) {
            return failResp('Unauthorized: empty identifier array');
        }

        // Searching for admin in AdminStore
        const vaultAdmin = txCore.adminStore.getAdminByIdentifiers(identifiers);
        if (!vaultAdmin) {
            if(!reqHeader['x-txadmin-identifiers'].includes('license:')) {
                return failResp('Unauthorized: you do not have a license identifier, which means the server probably has sv_lan enabled. Please disable sv_lan and restart the server to use the in-game menu.');
            } else {
                //this one is handled differently in resource/menu/client/cl_base.lua
                return failResp('nui_admin_not_found');
            }
        }
        return successResp(vaultAdmin, undefined);
    } catch (error) {
        console.debug(`Error validating session data: ${(error as Error).message}`);
        return failResp('Error validating auth header');
    }
};
