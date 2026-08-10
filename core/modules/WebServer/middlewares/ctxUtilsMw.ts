import type { Next } from 'koa';
import getReactIndex from '../getReactIndex';
import type { CtxWithVars } from '../ctxTypes';

export type CtxTxUtils = {
    send: <T = string | object>(data: T) => void;
    utils: {
        error: (httpStatus?: number, message?: string) => void;
        serveReactIndex: () => Promise<void>;
    };
};

export default async function ctxUtilsMw(ctx: CtxWithVars, next: Next) {
    ctx.utils = {
        error: (httpStatus = 500, message = 'unknown error') => {
            ctx.status = httpStatus;
            ctx.body = {
                status: 'error',
                code: httpStatus,
                message,
            };
        },
        serveReactIndex: async () => {
            ctx.body = await getReactIndex(ctx);
            ctx.type = 'text/html';
        },
    };
    ctx.send = <T = string | object>(data: T) => {
        ctx.body = data;
    };
    return next();
}
