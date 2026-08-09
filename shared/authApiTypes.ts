import type { ApiAuthErrorResp } from './genericApiTypes';

export type ReactAuthDataType = {
    name: string;
    email?: string;
    chyaroLinked: boolean;
    permissions: string[];
    isMaster: boolean;
    isTempPassword: boolean;
    profilePicture?: string;
    discordAvatar?: string;
    discordIdentifier?: string;
    cfxIdentifier?: string;
    locale?: string;
    csrfToken?: string;
};

export type ApiSelfResp = ApiAuthErrorResp | ReactAuthDataType;
export type ApiLogoutResp = { logout: true };

export type ApiVerifyPasswordReq = { username: string; password: string };
export type ApiVerifyPasswordResp = { error: string } | ReactAuthDataType;
export type ApiChangePasswordReq = { oldPassword?: string; newPassword: string };
export type ApiSelfPreferencesReq = { locale: string };
export type ApiSelfPreferencesResp = { success: true; locale: string } | { error: string };

export type ApiSelfIdentifiersResp = {
    success: true;
    cfxIdentifier?: string;
    discordIdentifier?: string;
} | {
    error: string;
};
