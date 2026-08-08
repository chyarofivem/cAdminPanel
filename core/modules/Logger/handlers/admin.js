const modulename = 'Logger:Admin';
import consoleFactory from '@lib/console';
import { chalkInversePad } from '@lib/misc';
const console = consoleFactory(modulename);


/**
 * Compatibility facade for the existing action-logging call sites.
 * Persistence is owned by TxAdminLogger so actions and in-server events share
 * one daily-rotated stream.
 */
export default class AdminLogger {
    constructor(combinedLogger) {
        this.combinedLogger = combinedLogger;
        this.writeCounter = 0;
        this.lrErrors = 0;
        this.lrLastError = undefined;
    }

    /**
     * Returns a string with short usage stats
     */
    getUsageStats() {
        return {
            writes: this.writeCounter,
            lrErrors: this.lrErrors,
        };
    }

    /**
     * Returns an string with everything in admin.log (the active log rotate file)
     */
    async getRecentBuffer() {
        return this.combinedLogger.getRecentActionText();
    }

    /**
     * Handles the input of log data
     *
     * @param {string} author
     * @param {string} message
     */
    writeSystem(author, message) {
        this.combinedLogger.writeAction(author, message, 'SystemAction');
        this.writeCounter++;
    }


    /**
     * Handles the input of log data
     * TODO: add here discord log forwarding
     *
     * @param {string} author
     * @param {string} action
     * @param {'default'|'command'} type
     */
    write(author, action, type = 'default') {
        let saveMsg;
        const prefix = `[${author}]`;
        if (type === 'command') {
            saveMsg = `executed "${action}"`;
            console.log(prefix, `executed ` + chalkInversePad(action));
        } else {
            saveMsg = action;
            console.log(prefix, saveMsg);
        }
        this.combinedLogger.writeAction(
            author,
            saveMsg,
            type === 'command' ? 'AdminCommand' : 'AdminAction',
        );
        this.writeCounter++;
    }
};
