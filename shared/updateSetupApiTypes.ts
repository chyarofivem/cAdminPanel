import type { GenericApiErrorResp } from './genericApiTypes';

export type UpdateSetupFieldType = 'text' | 'password' | 'number' | 'url';

export type UpdateSetupField = {
    id: string;
    version: string;
    label: string;
    description: string;
    type: UpdateSetupFieldType;
    required: boolean;
    placeholder?: string;
    value?: string;
    hasStoredValue?: boolean;
};

export type UpdateSetupRelease = {
    version: string;
    title: string;
    changes: string[];
};

export type UpdateSetupData = {
    previousVersion: string | null;
    currentVersion: string;
    releases: UpdateSetupRelease[];
    fields: UpdateSetupField[];
};

export type UpdateSetupDataResp = UpdateSetupData | GenericApiErrorResp;
export type UpdateSetupCompleteReq = { values: Record<string, string> };
export type UpdateSetupCompleteResp = { success: true } | GenericApiErrorResp;
