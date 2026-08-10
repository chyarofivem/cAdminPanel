import { afterEach, describe, expect, it, vi } from 'vitest';
import handleFd3Messages from './handleFd3Messages';

const structuredTrace = (payload: Record<string, unknown>) => ({
    key: 1,
    value: {
        channel: 'citizen-server-impl',
        data: {
            type: 'script_structured_trace',
            resource: 'monitor',
            payload,
        },
        file: '',
        func: '',
        line: 0,
    },
});

describe('FXServer structured trace dispatch', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('stores resource reports from the direct FD3 channel', () => {
        const tmpUpdateResourceList = vi.fn();
        vi.stubGlobal('txCore', {
            fxRunner: { child: { mutex: 'current-mutex' } },
            fxResources: { tmpUpdateResourceList },
        });
        const resources = [{ name: 'monitor', status: 'started' }];

        handleFd3Messages('current-mutex', structuredTrace({
            type: 'txAdminResourceReport',
            resources,
        }));

        expect(tmpUpdateResourceList).toHaveBeenCalledWith(resources);
    });

    it('audits and forwards a delivered announcement without broadcasting it twice', () => {
        const sendEvent = vi.fn();
        const write = vi.fn();
        const sendAnnouncement = vi.fn();
        vi.stubGlobal('txCore', {
            fxRunner: { child: { mutex: 'current-mutex' }, sendEvent },
            logger: { admin: { write } },
            adminStore: { getAdminPublicName: vi.fn(() => 'Public Admin') },
            discordBot: { sendAnnouncement },
        });

        handleFd3Messages('current-mutex', structuredTrace({
            type: 'txAdminCommandBridge',
            command: 'announcement',
            author: 'Master',
            message: 'Server message',
            delivered: true,
        }));

        expect(write).toHaveBeenCalledWith('Master', 'Sending announcement: Server message');
        expect(sendEvent).not.toHaveBeenCalled();
        expect(sendAnnouncement).toHaveBeenCalledOnce();
    });
});
