import os from 'node:os';
import getOsDistro from './getOsDistro.js';

export type HostStaticData = {
    nodeVersion: string;
    osDistro: string;
    cpu: {
        manufacturer: string;
        brand: string;
        physicalCores: number;
        cores: number;
    };
};

let cachedHostData: HostStaticData | undefined;

export const initializeHostStaticData = async () => {
    if (cachedHostData) return cachedHostData;
    const cpus = os.cpus();
    const firstCpu = cpus[0];
    cachedHostData = {
        nodeVersion: process.version,
        osDistro: await getOsDistro(),
        cpu: {
            manufacturer: '',
            brand: firstCpu?.model?.trim() || 'Unknown CPU',
            physicalCores: cpus.length,
            cores: cpus.length,
        },
    };
    return cachedHostData;
};

export const getHostStaticData = () => {
    if (!cachedHostData) throw new Error('Host data has not finished loading.');
    return cachedHostData;
};
