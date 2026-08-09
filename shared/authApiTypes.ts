import type { ApiAuthErrorResp } from './genericApiTypes';

export type ReactAuthDataType = {
    name: string;
    email?: string;
    permissions: string[];
    isMaster: boolean;
    isTempPassword: boolean;
    profilePicture?: string;
    discordAvatar?: string;
    discordIdentifier?: string;
    cfxIdentifier?: string;
    csrfToken?: string;
};

export type ApiSelfResp = ApiAuthErrorResp | ReactAuthDataType;
export type ApiLogoutResp = { logout: true };
