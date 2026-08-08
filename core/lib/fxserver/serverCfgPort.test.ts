import { describe, expect, it } from 'vitest';
import { getTcpPortFromServerCfg } from './serverCfgPort';

describe('server.cfg TCP port detection', () => {
    it('reads a quoted custom endpoint', () => {
        expect(getTcpPortFromServerCfg('endpoint_add_tcp "0.0.0.0:30121"')).toBe(30121);
    });

    it('supports unquoted and single-quoted endpoints', () => {
        expect(getTcpPortFromServerCfg('endpoint_add_tcp 127.0.0.1:40120')).toBe(40120);
        expect(getTcpPortFromServerCfg("endpoint_add_tcp '[::]:30122'")).toBe(30122);
    });

    it('uses the configured fallback and then the FiveM default', () => {
        expect(getTcpPortFromServerCfg('# no endpoint here', 30200)).toBe(30200);
        expect(getTcpPortFromServerCfg('# no endpoint here')).toBe(30120);
    });

    it('rejects invalid port ranges', () => {
        expect(getTcpPortFromServerCfg('endpoint_add_tcp "0.0.0.0:99999"', 30300)).toBe(30300);
    });
});
