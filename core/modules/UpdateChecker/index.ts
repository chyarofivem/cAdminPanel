const modulename = 'UpdateChecker';
import consoleFactory from '@lib/console';
import type { UpdateDataType } from '@shared/otherTypes';
import type { UpdateAvailableEventType } from '@shared/socketioTypes';
import { queryPanelRelease } from './queryPanelRelease';
import { queryFxserverChangelog } from './queryFxserverChangelog';
const console = consoleFactory(modulename);


const CHECK_INTERVAL = 15 * 60_000;


/**
 * Checks for cAdminPanel and FXServer updates, then notifies the console and the UI.
 * The panel version is checked against this repository's GitHub releases, and the FXServer
 * build against the Cfx.re artifact recommendations.
 */
export default class UpdateChecker {
    public readonly timers: NodeJS.Timer[] = [];

    public panelUpdateData?: UpdateDataType;
    public fxsUpdateData?: UpdateDataType;

    //Console notices repeat only when the target version changes, the UI gets every cycle
    #notifiedPanelVersion?: string;
    #notifiedFxsVersion?: string;

    constructor() {
        //Check for updates ASAP, then every 15 mins
        setImmediate(() => {
            this.checkUpdates();
        });
        this.timers.push(setInterval(() => {
            this.checkUpdates();
        }, CHECK_INTERVAL));
    }


    /**
     * The current update state, or undefined when everything is up to date.
     * Used to notify clients that connect between checks.
     */
    get updateEventData(): UpdateAvailableEventType | undefined {
        if (!this.panelUpdateData && !this.fxsUpdateData) return;
        return {
            panel: this.panelUpdateData,
            fxserver: this.fxsUpdateData,
        };
    }


    /**
     * Queries both sources and updates the state.
     * A failed query keeps the previous result instead of clearing it, so a temporary
     * network problem does not make an existing notice disappear.
     */
    async checkUpdates() {
        const [panelResult, fxsResult] = await Promise.all([
            queryPanelRelease(),
            queryFxserverChangelog(),
        ]);

        if (panelResult.success) {
            this.panelUpdateData = panelResult.update;
            if (!panelResult.update) this.#notifiedPanelVersion = undefined;
        }
        if (fxsResult.success) {
            this.fxsUpdateData = fxsResult.update;
            if (!fxsResult.update) this.#notifiedFxsVersion = undefined;
        }

        this.printPanelNotice();
        this.printFxsNotice();

        const eventData = this.updateEventData;
        if (eventData) {
            txCore.webServer.webSocket.pushEvent<UpdateAvailableEventType>('updateAvailable', eventData);
        }
    }


    private printPanelNotice() {
        const update = this.panelUpdateData;
        if (!update || this.#notifiedPanelVersion === update.version) return;
        this.#notifiedPanelVersion = update.version;
        const log = update.isImportant ? console.error : console.warn;
        if (update.isImportant) {
            log(`This version of cAdminPanel is outdated, v${update.version} is available.`);
            log('Please update as soon as possible.');
        } else {
            log(`A patch (bug fix) update is available for cAdminPanel: v${update.version}.`);
            log('If you are experiencing any kind of issue, please update now.');
        }
        if (update.url) log(update.url);
    }


    private printFxsNotice() {
        const update = this.fxsUpdateData;
        if (!update || this.#notifiedFxsVersion === update.version) return;
        this.#notifiedFxsVersion = update.version;
        //Only important FXServer updates are worth a console line, the UI shows the rest
        if (update.isImportant) {
            console.warn(`Your FXServer is outdated, build ${update.version} is recommended.`);
        } else {
            console.verbose.debug(`Optional FXServer update available: build ${update.version}.`);
        }
    }
};
