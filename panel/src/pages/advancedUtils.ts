export const isSensitiveAdvancedCommand = (command: string) => (
    /^set\s+discordBot\.token(?:\.|\s|$)/i.test(command.trim())
);
