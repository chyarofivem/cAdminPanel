import type { GenericApiErrorResp } from './genericApiTypes';

export type DeployerRecipeSummary = {
    name: string;
    author: string;
    description: string;
    isTrustedSource: boolean;
    raw: string;
};

export type DeployerInputVariable = {
    name: string;
    value: string;
    description: string;
};

export type DeployerDefaults = {
    autofilled: boolean;
    license: string;
    mysqlHost: string;
    mysqlPort: string;
    mysqlUser: string;
    mysqlPassword: string;
    mysqlDatabase: string;
};

export type DeployerData = {
    deploymentID: string;
} & (
    | { step: 'review'; recipe: DeployerRecipeSummary }
    | {
        step: 'input';
        requireDBConfig: boolean;
        hostConfigSource: string;
        defaults: DeployerDefaults;
        inputVars: DeployerInputVariable[];
    }
    | {
        step: 'run';
        deployPath: string;
        progress: number;
        log: string;
        status: 'running' | 'failed';
    }
    | { step: 'configure'; serverCFG: string; framework: string }
);

export type DeployerDataResp = DeployerData | { redirect: string } | GenericApiErrorResp;

export type DeployerActionResp = {
    success: true;
    installCadminDialog?: boolean;
    framework?: string;
} | {
    success?: false;
    refresh?: boolean;
    type?: 'danger' | 'warning';
    message?: string;
    markdown?: boolean;
};
