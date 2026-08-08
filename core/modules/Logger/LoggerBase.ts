const modulename = 'Logger:Base';
import fs from 'node:fs';
import path from 'node:path';
import * as rfs from 'rotating-file-stream';
import { cloneDeep, defaultsDeep } from 'lodash-es';
import consoleFactory from '@lib/console';
import { getLogSizes, getLogDivider } from './loggerUtils';
import { getTimeFilename } from '@lib/misc';
const console = consoleFactory(modulename);


/**
 * Default class for logger instances.
 * Implements log-rotate, listLogFiles() and getLogFile()
 */
export class LoggerBase {
    lrStream: rfs.RotatingFileStream;
    lrErrors = 0;
    public activeFilePath: string;
    public lrLastError: string | undefined;
    protected readonly basePath: string;
    protected readonly persistentLoggingEnabled: boolean;
    private logNameRegex: RegExp;

    constructor(
        basePath: string,
        logName: string,
        lrDefaultOptions: rfs.Options,
        lrProfileConfig: rfs.Options | false = false,
        writeRotationDivider = true,
    ) {
        //Sanity check
        if (!basePath || !logName) throw new Error('Missing constructor parameters');
        this.basePath = basePath;
        this.persistentLoggingEnabled = lrProfileConfig !== false;
        this.activeFilePath = path.join(basePath, `${logName}.log`);
        this.logNameRegex = new RegExp(`^${logName}(_\\d{4}-\\d{2}-\\d{2}_\\d{2}-\\d{2}-\\d{2}(_\\d+)?)?.log$`);

        //If disabled
        if (lrProfileConfig === false) {
            console.warn('persistent logging disabled for:', logName);
            this.lrStream = {
                write: () => { },
            } as any as rfs.RotatingFileStream;
            return;
        }

        //Setting log rotate up
        const lrOptions = cloneDeep(lrProfileConfig);
        if (typeof lrProfileConfig === 'object') {
            defaultsDeep(lrOptions, lrDefaultOptions);
        }

        const filenameGenerator: rfs.Generator = (time, index) => {
            return time
                ? `${logName}_${getTimeFilename(time)}_${index}.log`
                : `${logName}.log`;
        };

        this.lrStream = rfs.createStream(filenameGenerator, lrOptions);
        this.lrStream.on('rotated', (filename) => {
            if (writeRotationDivider) {
                this.lrStream.write(getLogDivider('Log Rotated'));
            }
            console.verbose.log(`Rotated file ${filename}`);
        });
        this.lrStream.on('error', (error) => {
            if ((error as any).code !== 'ERR_STREAM_DESTROYED') {
                console.verbose.error(error, logName);
                this.lrErrors++;
                this.lrLastError = error.message;
            }
        });
    }

    /**
     * Rotates the active file immediately.
     *
     * rotating-file-stream intentionally keeps this method private in its
     * TypeScript declaration, but exposes it on the runtime instance. Keeping
     * this compatibility shim here prevents specialized loggers from reaching
     * into the dependency directly.
     */
    protected async rotateNow() {
        if (!this.persistentLoggingEnabled) return;
        const stream = this.lrStream as unknown as { rotate: () => Promise<void> };
        if (typeof stream.rotate !== 'function') {
            throw new Error('The active rotating file stream cannot be rotated manually.');
        }
        await stream.rotate();
    }

    listLogFiles() {
        return getLogSizes(this.basePath, this.logNameRegex);
    }

    getLogFile(fileName: string) {
        if (!this.logNameRegex.test(fileName)) throw new Error('fileName doesn\'t match regex');
        return fs.createReadStream(path.join(this.basePath, fileName));
    }
};
