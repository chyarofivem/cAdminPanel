const modulename = 'WebServer:SessionStorage';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import throttle from 'lodash-es/throttle.js';
import type { PassSessAuthType } from "../authLogic";
import { LRUCacheWithDelete } from "mnemonist";
import { RawKoaCtx } from "../ctxTypes";
import { Next } from "koa";
import { randomUUID } from 'node:crypto';
import { Socket } from "socket.io";
import { parse as cookieParse } from 'cookie';
import { SetOption as KoaCookieSetOption } from "cookies";
import type { DeepReadonly } from 'utility-types';
import { txEnv } from '@core/globalData';
import consoleFactory from '@lib/console';
const console = consoleFactory(modulename);

//Consts
const SESSIONS_FILE_NAME = 'sessions.json';
const SESSIONS_FILE_VERSION = 1;
const SESSIONS_MAX_ENTRIES = 5000;

//Types
export type ValidSessionType = {
    auth?: PassSessAuthType;
}
export type SessToolsType = {
    get: () => DeepReadonly<ValidSessionType> | undefined;
    set: (sess: ValidSessionType) => void;
    destroy: () => void;
}
type StoredSessionType = {
    expires: number;
    data: ValidSessionType;
}

/**
 * Storage for the sessions, persisted to `txData/<profile>/data/sessions.json`
 * so that being signed in survives a txAdmin restart.
 * The session cookie name is derived from the profile path, therefore a restored
 * session id still matches the cookie the browser already holds.
 */
export class SessionStorage {
    private readonly sessions = new LRUCacheWithDelete<string, StoredSessionType>(SESSIONS_MAX_ENTRIES);
    public readonly maxAgeMs = 24 * 60 * 60 * 1000;
    private readonly sessionsFilePath = `${txEnv.profilePath}/data/${SESSIONS_FILE_NAME}`;
    private readonly throttledSaveSessions = throttle(
        this.saveSessions.bind(this),
        10_000,
        { leading: false, trailing: true }
    );

    constructor(maxAgeMs?: number) {
        if (maxAgeMs) {
            this.maxAgeMs = maxAgeMs;
        }

        this.loadSessions();

        //Cleanup every 5 mins
        setInterval(() => {
            const now = Date.now();
            let removed = 0;
            for (const [key, sess] of this.sessions) {
                if (sess.expires < now) {
                    this.sessions.delete(key);
                    removed++;
                }
            }
            if (removed) this.throttledSaveSessions();
        }, 5 * 60_000);
    }

    get(key: string) {
        const stored = this.sessions.get(key);
        if (!stored) return;
        if (stored.expires < Date.now()) {
            this.sessions.delete(key);
            this.throttledSaveSessions();
            return;
        }
        return stored.data as DeepReadonly<ValidSessionType>;
    }

    set(key: string, sess: ValidSessionType) {
        this.sessions.set(key, {
            expires: Date.now() + this.maxAgeMs,
            data: sess,
        });
        this.throttledSaveSessions();
    }

    refresh(key: string) {
        const stored = this.sessions.get(key);
        if (!stored) return;
        this.sessions.set(key, {
            expires: Date.now() + this.maxAgeMs,
            data: stored.data,
        });
        this.throttledSaveSessions();
    }

    destroy(key: string) {
        const wasDeleted = this.sessions.delete(key);
        if (wasDeleted) this.throttledSaveSessions();
        return wasDeleted;
    }

    get size() {
        return this.sessions.size;
    }

    /**
     * Persists the sessions. The file holds password hashes and CSRF tokens, so
     * it is created with owner-only permissions, just like admins.json is only
     * meant to be readable by the txAdmin process user.
     */
    private async saveSessions() {
        try {
            const now = Date.now();
            const entries = [...this.sessions.entries()]
                .filter(([, sess]) => sess.expires > now);
            await fsp.writeFile(
                this.sessionsFilePath,
                JSON.stringify({ version: SESSIONS_FILE_VERSION, sessions: entries }),
                { encoding: 'utf8', mode: 0o600 },
            );
        } catch (error) {
            console.verbose.warn(`Unable to save ${SESSIONS_FILE_NAME}: ${(error as Error).message}`);
        }
    }

    /**
     * Loads the persisted sessions, dropping anything expired or malformed.
     * Sync on purpose: requests can arrive as soon as the web server is up.
     */
    private loadSessions() {
        try {
            const fileData = JSON.parse(fs.readFileSync(this.sessionsFilePath, 'utf8'));
            if (fileData?.version !== SESSIONS_FILE_VERSION) throw new Error('invalid_version');
            if (!Array.isArray(fileData.sessions)) throw new Error('invalid_data');
            const now = Date.now();
            let loaded = 0;
            for (const entry of fileData.sessions) {
                if (!Array.isArray(entry) || entry.length !== 2) continue;
                const [key, sess] = entry;
                if (!isValidSessId(key)) continue;
                if (typeof sess?.expires !== 'number' || sess.expires < now) continue;
                if (typeof sess.data !== 'object' || sess.data === null) continue;
                this.sessions.set(key, { expires: sess.expires, data: sess.data });
                loaded++;
            }
            console.verbose.ok(`Loaded ${SESSIONS_FILE_NAME} with ${loaded} sessions.`);
        } catch (error) {
            this.sessions.clear();
            if ((error as any)?.code === 'ENOENT') {
                console.verbose.debug(`${SESSIONS_FILE_NAME} not found, making a new one.`);
            } else {
                console.warn(`Failed to load ${SESSIONS_FILE_NAME}: ${(error as Error).message}`);
                console.warn('Since this is not a critical file, it will be reset and everyone will need to sign in again.');
            }
        }
    }
}


/**
 * Helper to check if the session id is valid
 */
const isValidSessId = (sessId: string) => {
    if (typeof sessId !== 'string') return false;
    if (sessId.length !== 36) return false;
    return true;
}


/**
 * Middleware factory to add sessTools to the koa context.
 */
export const koaSessMw = (cookieName: string, store: SessionStorage) => {
    const baseCookieOptions = {
        path: '/',
        maxAge: store.maxAgeMs,
        httpOnly: true,
        sameSite: 'lax',
        overwrite: true,
        signed: false,
    } as KoaCookieSetOption;

    /**
     * The `Secure` flag can only be set when the connection is actually encrypted,
     * otherwise koa refuses to send the cookie and nobody would be able to sign in.
     * NOTE: `ctx.request.secure` is false for TLS terminated by a reverse proxy,
     * since we do not trust `X-Forwarded-Proto` (`app.proxy` is disabled on purpose).
     */
    const getCookieOptions = (ctx: RawKoaCtx) => ({
        ...baseCookieOptions,
        secure: ctx.request.secure,
    }) as KoaCookieSetOption;

    //Middleware
    return (ctx: RawKoaCtx, next: Next) => {
        const cookieOptions = getCookieOptions(ctx);
        const sessGet = () => {
            const sessId = ctx.cookies.get(cookieName);
            if (!sessId || !isValidSessId(sessId)) return;
            const stored = store.get(sessId);
            if (!stored) return;
            ctx._refreshSessionCookieId = sessId;
            return stored;
        }

        const sessSet = (sess: ValidSessionType) => {
            const sessId = ctx.cookies.get(cookieName);
            if (!sessId || !isValidSessId(sessId)) {
                const newSessId = randomUUID();
                ctx.cookies.set(cookieName, newSessId, cookieOptions);
                store.set(newSessId, sess);
            } else {
                store.set(sessId, sess);
            }
        }

        const sessDestroy = () => {
            const sessId = ctx.cookies.get(cookieName);
            if (!sessId || !isValidSessId(sessId)) return;
            store.destroy(sessId);
            ctx.cookies.set(cookieName, 'unset', cookieOptions);
        }

        ctx.sessTools = {
            get: sessGet,
            set: sessSet,
            destroy: sessDestroy,
        } satisfies SessToolsType;

        try {
            return next();
        } catch (error) {
            throw error;
        } finally {
            if (typeof ctx._refreshSessionCookieId === 'string') {
                ctx.cookies.set(cookieName, ctx._refreshSessionCookieId, cookieOptions);
                store.refresh(ctx._refreshSessionCookieId);
            }
        }
    }
}


/**
 * Middleware factory to add sessTools to the socket context.
 * 
 * NOTE: The set() and destroy() functions are NO-OPs because we cannot set cookies in socket.io,
 *  but that's fine since socket pages are always accompanied by a web page,
 *  and webSocket.handleConnection() drops the connection if authLogic fails.
 */
export const socketioSessMw = (cookieName: string, store: SessionStorage) => {
    return async (socket: Socket & { sessTools?: SessToolsType }, next: Function) => {
        const sessGet = () => {
            const cookiesString = socket?.handshake?.headers?.cookie;
            if (typeof cookiesString !== 'string') return;
            const cookies = cookieParse(cookiesString);
            const sessId = cookies[cookieName];
            if (!sessId || !isValidSessId(sessId)) return;
            return store.get(sessId);
        }

        socket.sessTools = {
            get: sessGet,
            set: (sess: ValidSessionType) => { },
            destroy: () => { },
        } satisfies SessToolsType;

        return next();
    }
}
