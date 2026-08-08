import { z } from "zod";
import { typeDefinedConfig } from "./utils";
import { SYM_FIXER_FATAL } from "@lib/symbols";


/*
    The logger module passes the options to the library which is responsible for evaluating them.
    There has never been strict definitions about those settings in txAdmin.
    The only exception is setting it to false for disabling the specific logger.
    Ref: https://github.com/iccicci/rotating-file-stream#options
*/
const rfsOptionValidator = z.union([
    z.literal(false),
    z.object({}).passthrough(),
]);


//NOTE: don't fallback to default because storage issues might crash the server
export default {
    //Legacy keys retained so existing profiles continue to parse cleanly.
    admin: typeDefinedConfig({
        name: 'Legacy Admin Logs',
        default: {},
        validator: rfsOptionValidator,
        fixer: SYM_FIXER_FATAL,
    }),
    //fxserver output
    fxserver: typeDefinedConfig({
        name: 'FXServer Logs',
        default: {},
        validator: rfsOptionValidator,
        fixer: SYM_FIXER_FATAL,
    }),
    //in-game logs
    server: typeDefinedConfig({
        name: 'Legacy Server Logs',
        default: {},
        validator: rfsOptionValidator,
        fixer: SYM_FIXER_FATAL,
    }),
    //combined in-game events and administrative actions
    txadmin: typeDefinedConfig({
        name: 'txAdmin Logs',
        default: {},
        validator: rfsOptionValidator,
        fixer: SYM_FIXER_FATAL,
    }),
} as const;
