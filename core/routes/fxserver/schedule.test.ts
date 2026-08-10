import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FXServerSchedule from './schedule';

const setNextTempSchedule = vi.fn();
const setNextSkip = vi.fn();

const makeCtx = (action: string, parameter: unknown) => ({
    request: { body: { action, parameter } },
    admin: {
        name: 'Master',
        testPermission: vi.fn(() => true),
        logAction: vi.fn(),
    },
    send: vi.fn((value: unknown) => value),
}) as any;

describe('FXServer restart schedule route', () => {
    beforeEach(() => {
        setNextTempSchedule.mockClear();
        setNextSkip.mockClear();
        vi.stubGlobal('txCore', {
            fxScheduler: { setNextTempSchedule, setNextSkip },
        });
    });

    afterEach(() => vi.unstubAllGlobals());

    it('schedules the next temporary restart', async () => {
        const ctx = makeCtx('setNextTempSchedule', '+15');

        const response = await FXServerSchedule(ctx);

        expect(setNextTempSchedule).toHaveBeenCalledWith('+15');
        expect(response).toEqual({ type: 'success', msg: 'Restart scheduled.' });
    });

    it('cancels the next restart with a strict boolean state', async () => {
        const ctx = makeCtx('setNextSkip', true);

        const response = await FXServerSchedule(ctx);

        expect(setNextSkip).toHaveBeenCalledWith(true, 'Master');
        expect(ctx.admin.logAction).toHaveBeenCalledWith('Cancelling next scheduled restart.');
        expect(response).toEqual({ type: 'success', msg: 'Next restart cancelled.' });
    });

    it('rejects non-boolean cancellation values', async () => {
        const ctx = makeCtx('setNextSkip', 'true');

        const response = await FXServerSchedule(ctx);

        expect(setNextSkip).not.toHaveBeenCalled();
        expect(response).toEqual({ type: 'error', msg: 'Invalid restart cancellation state.' });
    });
});
