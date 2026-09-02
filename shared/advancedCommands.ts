import type { GenericApiErrorResp } from "./genericApiTypes";

//NOTE: these live here and not in the route because the panel cannot import from
//core. The route asserts its zod schema against RunAdvancedCommandReq.
export type RunAdvancedCommandReq = {
    cmd: string;
}
export type RunAdvancedCommandRespSuccess = {
    type: 'md' | 'json';
    data: string;
}
export type RunAdvancedCommandResp = RunAdvancedCommandRespSuccess | GenericApiErrorResp;


type AdvancedCommand = {
    name: string;
    desc: string;
    args?: string[];
}
export const advancedCommands: AdvancedCommand[] = [
    //txAdmin
    {
        name: 'verbose',
        desc: 'Sets the verbosity of the panel console.',
        args: ['true/false'],
    },
    {
        name: 'set',
        desc: 'Sets a panel config value.',
        args: ['scope.key', 'json-encoded value'],
    },
    {
        name: 'printFullPlayerList',
        desc: 'Print the entire player list json.',
    },
    {
        name: 'printFxResourcesBootLog',
        desc: 'Print the latest server resource boot log.',
    },
    {
        name: 'printFxRunnerChildHistory',
        desc: 'Print the history of all fxRunner child processes.',
    },
    {
        name: 'printLoggerErrors',
        desc: 'Print the latest logger errors.',
    },

    //Database
    // {
    //     name: 'dbComparePlayers',
    //     desc: 'Compares the data from two players',
    //     args: ['license1', 'license2'],
    // },
    // {
    //     name: 'dbPurgeId',
    //     desc: 'Purges an identifier from the database. Actions with only this identifier will be removed.',
    //     args: ['id/hwid'],
    // },
    // {
    //     name: 'dbFindCollisions',
    //     desc: 'TODO',
    //     args: ['id/hwid'],
    // },
    

    //Server
    {
        name: 'forceUpdateMutableConvars',
        desc: 'Force update the server mutable panel convars.',
    },
    {
        name: 'safelyRestartMonitorResource',
        desc: 'Restarts the server\'s "monitor" resource in a safe way by restoring the luaComToken convar before ensuring it.',
    },
    {
        name: 'forceReauthRecentPlayers',
        desc: 'Forces the last N players that joined the server to reauth.',
        args: ['number of players'],
    },

    //Process
    {
        name: 'printProcessEnv',
        desc: 'Print the process environment variables.',
    },
    {
        name: 'printProcessMemoryUsage',
        desc: 'Prints the process memory usage.',
    },
    {
        name: 'freezeProcess',
        desc: 'Freezes the NodeJS runtime by N seconds',
        args: ['number of seconds'],
    },
    {
        name: 'saveHeapSnapshot',
        desc: 'Saves a heap snapshot.',
    },
    // {
    //     name: 'forceGarbageCollection',
    //     desc: '',
    //     args: [],
    // },

    //Other
    {
        name: 'printPublicIp',
        desc: 'Fetches the public IP of the server.',
    },
    {
        name: 'printClockInfo',
        desc: 'Fetches the current clock info.',
    },
];
