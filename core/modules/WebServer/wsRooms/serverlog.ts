import type { RoomType } from "../webSocket";

/**
 * Streams normalized entries for the combined panel log page.
 */
export default {
    permission: 'panel.log.view',
    eventName: 'logData',
    cumulativeBuffer: true,
    outBuffer: [],
    initialData: () => txCore.logger.txadmin.getRecentBuffer(250),
    commands: {},
} satisfies RoomType;
