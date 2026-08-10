export function validateRestartSchedule(input: string) {
    const normalized = input.trim();
    const relativeMatch = /^\+(\d+)$/.exec(normalized);
    if (relativeMatch) {
        const minutes = Number(relativeMatch[1]);
        return minutes >= 1 && minutes < 1440;
    }

    const absoluteMatch = /^(\d{1,2}):(\d{2})$/.exec(normalized);
    if (!absoluteMatch) return false;
    const hours = Number(absoluteMatch[1]);
    const minutes = Number(absoluteMatch[2]);
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}
