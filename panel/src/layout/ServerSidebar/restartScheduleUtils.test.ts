import { describe, expect, it } from 'vitest';
import { validateRestartSchedule } from './restartScheduleValidation';

describe('restart schedule input', () => {
    it.each(['+1', '+15', '+1439', '00:00', '7:05', '23:59', '  +30  '])(
        'accepts %s',
        input => expect(validateRestartSchedule(input)).toBe(true),
    );

    it.each(['', '+0', '+1440', '+5 minutes', '24:00', '12:60', '12:5', '12:30:00', '12:30,13:30'])(
        'rejects %s',
        input => expect(validateRestartSchedule(input)).toBe(false),
    );
});
