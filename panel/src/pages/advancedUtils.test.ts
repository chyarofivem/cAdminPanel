import { describe, expect, test } from 'vitest';
import { isSensitiveAdvancedCommand } from './advancedUtils';

describe('advanced command URL safety', () => {
    test('detects Discord bot token set commands', () => {
        expect(isSensitiveAdvancedCommand('set discordBot.token "secret"')).toBe(true);
        expect(isSensitiveAdvancedCommand('SET discordBot.token.extra "secret"')).toBe(true);
    });

    test('allows non-sensitive advanced commands', () => {
        expect(isSensitiveAdvancedCommand('set discordBot.guild "123"')).toBe(false);
        expect(isSensitiveAdvancedCommand('printFullPlayerList')).toBe(false);
    });
});
