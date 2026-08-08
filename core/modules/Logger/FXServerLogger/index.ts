const modulename = 'Logger:FXServer';
import fs from 'node:fs';
import path from 'node:path';
import bytes from 'bytes';
import type { Options as RfsOptions } from 'rotating-file-stream';
import { getLogDivider } from '../loggerUtils.js';
import consoleFactory, { processStdioWriteRaw } from '@lib/console.js';
import { LoggerBase } from '../LoggerBase.js';
import ConsoleTransformer from './ConsoleTransformer.js';
import ConsoleLineEnum from './ConsoleLineEnum.js';
import { txHostConfig } from '@core/globalData.js';
const console = consoleFactory(modulename);


//This regex was done in the first place to prevent fxserver output to be interpreted as txAdmin output by the host terminal
//IIRC the issue was that one user with a TM on their nick was making txAdmin's console to close or freeze. I couldn't reproduce the issue.
// \x00-\x08 Control characters in the ASCII table.
// allow \r and \t
// \x0B-\x1A Vertical tab and control characters from shift out to substitute.
// allow \x1B (escape for colors n stuff)
// \x1C-\x1F Control characters (file separator, group separator, record separator, unit separator).
// allow all printable
// \x7F Delete character.
const regexControls = /[\x00-\x08\x0B-\x1A\x1C-\x1F\x7F]|(?:\x1B\[|\x9B)[\d;]+[@-K]/g;
const regexColors = /\x1B[^m]*?m/g;
const STARTS_PER_LOG_SEGMENT = 3;
const RESTART_STATE_FILENAME = 'fxserver.restart-count';

export const nextConsoleSegmentState = (currentStarts: number) => ({
    shouldRotate: currentStarts >= STARTS_PER_LOG_SEGMENT,
    nextStarts: currentStarts >= STARTS_PER_LOG_SEGMENT ? 1 : currentStarts + 1,
});

const enforceRestartRotation = (profileConfig: RfsOptions | false): RfsOptions | false => {
    if (profileConfig === false) return false;
    const {
        interval: _interval,
        intervalBoundary: _intervalBoundary,
        initialRotation: _initialRotation,
        ...storageOptions
    } = profileConfig;
    return {
        ...storageOptions,
        initialRotation: false,
    };
};


export default class FXServerLogger extends LoggerBase {
    private readonly transformer = new ConsoleTransformer();
    private fileBuffer = '';
    private recentBuffer = '';
    private readonly recentBufferMaxSize = 256 * 1024; //kb
    private readonly recentBufferTrimSliceSize = 32 * 1024; //how much will be cut when overflows
    private readonly restartStatePath: string;
    private startsInActiveFile: number;

    constructor(basePath: string, lrProfileConfig: RfsOptions | false) {
        const lrDefaultOptions = {
            path: basePath,
            initialRotation: false,
            history: 'fxserver.history',
            // compress: 'gzip',
            maxFiles: 7,
            maxSize: '5G',
        };
        super(basePath, 'fxserver', lrDefaultOptions, enforceRestartRotation(lrProfileConfig));

        this.restartStatePath = path.join(basePath, RESTART_STATE_FILENAME);
        this.startsInActiveFile = this.readRestartCount();

        setInterval(() => {
            void this.flushFileBuffer().catch((error) => {
                console.verbose.error(`Failed to flush FXServer log: ${(error as Error).message}`);
            });
        }, 5000);
    }

    private readRestartCount() {
        if (!this.persistentLoggingEnabled) return 0;
        try {
            const stored = Number.parseInt(fs.readFileSync(this.restartStatePath, 'utf8').trim(), 10);
            if (Number.isInteger(stored) && stored >= 0 && stored <= STARTS_PER_LOG_SEGMENT) {
                return stored;
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                console.verbose.warn(`Could not read ${RESTART_STATE_FILENAME}; starting a new count.`);
            }
        }

        // On migration, rotate a pre-existing daily log before starting the
        // first restart-counted segment.
        try {
            return fs.statSync(this.activeFilePath).size > 0 ? STARTS_PER_LOG_SEGMENT : 0;
        } catch {
            return 0;
        }
    }

    private persistRestartCount() {
        if (!this.persistentLoggingEnabled) return;
        try {
            fs.mkdirSync(path.dirname(this.restartStatePath), { recursive: true });
            fs.writeFileSync(this.restartStatePath, String(this.startsInActiveFile), 'utf8');
        } catch (error) {
            console.verbose.warn(`Could not persist ${RESTART_STATE_FILENAME}: ${(error as Error).message}`);
        }
    }


    /**
     * Returns a string with short usage stats
     */
    getUsageStats() {
        return {
            buffer: bytes(this.recentBuffer.length)!,
            lrErrors: this.lrErrors,
        };
    }


    /**
     * Returns the recent fxserver buffer containing HTML markers, and not XSS escaped.
     * The size of this buffer is usually above 64kb, never above 128kb.
     */
    getRecentBuffer() {
        return this.recentBuffer;
    }


    /**
     * Strips color of the file buffer and flushes it.
     * FIXME: this will still allow colors to be written to the file if the buffer cuts 
     * in the middle of a color sequence, but less often since we are buffering more data.
     */
    async flushFileBuffer() {
        const pending = this.fileBuffer.replace(regexColors, '');
        this.fileBuffer = '';
        if (!pending || !this.persistentLoggingEnabled) return;
        await new Promise<void>((resolve, reject) => {
            this.lrStream.write(pending, (error) => error ? reject(error) : resolve());
        });
    }


    /**
     * Receives the assembled console blocks, stringifies, marks, colors them and dispatches it to
     * lrStream, websocket, and process stdout.
     */
    private ingest(type: ConsoleLineEnum, data: string, context?: string) {
        //Process the data
        const { webBuffer, stdoutBuffer, fileBuffer } = this.transformer.process(type, data, context);

        //To file
        this.fileBuffer += fileBuffer;

        //For the terminal
        if (!txConfig.server.quiet && !txHostConfig.forceQuietMode) {
            processStdioWriteRaw(stdoutBuffer);
        }

        //For the live console
        txCore.webServer.webSocket.buffer('liveconsole', webBuffer);
        this.appendRecent(webBuffer);
    }


    /**
     * Writes to the log an informational message
     */
    public logInformational(msg: string) {
        this.ingest(ConsoleLineEnum.MarkerInfo, msg + '\n');
    }


    /**
     * Writes to the log that the server is booting
     */
    public async logFxserverSpawn(pid: string) {
        await this.flushFileBuffer();
        const segmentState = nextConsoleSegmentState(this.startsInActiveFile);
        if (segmentState.shouldRotate) {
            try {
                await this.rotateNow();
                this.startsInActiveFile = 0;
            } catch (error) {
                console.error(`Failed to rotate the FXServer console log: ${(error as Error).message}`);
            }
        }
        this.startsInActiveFile = this.startsInActiveFile >= STARTS_PER_LOG_SEGMENT
            ? STARTS_PER_LOG_SEGMENT
            : this.startsInActiveFile + 1;
        this.persistRestartCount();

        //force line skip to create separation
        if (this.recentBuffer.length) {
            const lineBreak = this.transformer.lastEol ? '\n' : '\n\n';
            this.ingest(ConsoleLineEnum.MarkerInfo, lineBreak);
        }
        //need to break line
        const multiline = getLogDivider(`[${pid}] FXServer Starting`);
        for (const line of multiline.split('\n')) {
            if (!line.length) break;
            this.ingest(ConsoleLineEnum.MarkerInfo, line + '\n');
        }
    }


    /**
     * Writes to the log an admin command
     */
    public logAdminCommand(author: string, cmd: string) {
        this.ingest(ConsoleLineEnum.MarkerAdminCmd, cmd + '\n', author);
    }


    /**
     * Writes to the log a system command.
     */
    public logSystemCommand(cmd: string) {
        if(cmd.startsWith('txaEvent "consoleCommand"')) return;
        // if (/^txaEvent \w+ /.test(cmd)) {
        //     const [event, payload] = cmd.substring(9).split(' ', 2);
        //     cmd = chalk.italic(`<broadcasting txAdmin:events:${event}>`);
        // }
        this.ingest(ConsoleLineEnum.MarkerSystemCmd, cmd + '\n');
    }


    /**
     * Handles all stdio data.
     */
    public writeFxsOutput(
        source: ConsoleLineEnum.StdOut | ConsoleLineEnum.StdErr,
        data: string | Buffer
    ) {
        if (typeof data !== 'string') {
            data = data.toString();
        }
        this.ingest(source, data.replace(regexControls, ''));
    }


    /**
     * Appends data to the recent buffer and recycles it when necessary
     */
    private appendRecent(data: string) {
        this.recentBuffer += data;
        if (this.recentBuffer.length > this.recentBufferMaxSize) {
            this.recentBuffer = this.recentBuffer.slice(this.recentBufferTrimSliceSize - this.recentBufferMaxSize);
            this.recentBuffer = this.recentBuffer.substring(this.recentBuffer.indexOf('\n'));
            //FIXME: precisa encontrar o próximo tsMarker ao invés de \n
            //usar String.prototype.search() com regex

            //FIXME: salvar em 8 blocos de 32kb
            // quando atingir 32, quebrar no primeiro tsMarker
        }
    }
};
