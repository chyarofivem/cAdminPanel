import type { RoomType } from "../webSocket";

/**
 * Streams normalized entries for the combined txAdmin log page.
 */
export default {
    permission: 'txadmin.log.combined',
    eventName: 'logData',
    cumulativeBuffer: true,
    outBuffer: [],
    initialData: () => txCore.logger.txadmin.getRecentBuffer(250),
    commands: {},
} satisfies RoomType;
