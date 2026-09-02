import { txEnv, txHostConfig } from '@core/globalData';
import got from 'got';

export default got.extend({
    timeout: {
        request: 5000
    },
    headers: {
        'User-Agent': `cAdminPanel ${txEnv.txaVersion}`,
    },
    localAddress: txHostConfig.netInterface,
});
