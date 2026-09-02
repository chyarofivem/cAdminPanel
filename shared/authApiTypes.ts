import type { ApiAuthErrorResp } from './genericApiTypes';

export type ReactAuthDataType = {
    name: string;
    permissions: string[];
    isMaster: boolean;
    isTempPassword: boolean;
    profilePicture?: string;
    discordIdentifier?: string;
    cfxIdentifier?: string;
    locale?: string;
    accent?: string;
    accentColor?: string;
    csrfToken?: string;
};

export type ApiSelfResp = ApiAuthErrorResp | ReactAuthDataType;
export type ApiLogoutResp = { logout: true };

export type ApiVerifyPasswordReq = { username: string; password: string };
export type ApiVerifyPasswordResp = { error: string } | ReactAuthDataType;
export type ApiChangePasswordReq = { oldPassword?: string; newPassword: string };
export type ApiSelfPreferencesReq = { locale?: string; accent?: string };
export type ApiSelfPreferencesResp = {
    success: true;
    locale?: string;
    accent?: string;
    accentColor?: string;
} | { error: string };

export type ApiSelfIdentifiersResp = {
    success: true;
    cfxIdentifier?: string;
    discordIdentifier?: string;
} | {
    error: string;
};
