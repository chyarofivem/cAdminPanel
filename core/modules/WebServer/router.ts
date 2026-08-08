import { txDevEnv } from '@core/globalData';
import Router from '@koa/router';
import KoaRateLimit from 'koa-ratelimit';

import * as routes from '@routes/index';
import { apiAuthMw, hostAuthMw, intercomAuthMw, webAuthMw } from './middlewares/authMws';


/**
 * Router factory
 */
export default () => {
    const router = new Router();
    const authLimiter = KoaRateLimit({
        driver: 'memory',
        db: new Map(),
        duration: txConfig.webServer.limiterMinutes * 60 * 1000, // 15 minutes
        errorMessage: JSON.stringify({
            //Duplicated to maintain compatibility with all auth api routes
            error: `Too many attempts. Blocked for ${txConfig.webServer.limiterMinutes} minutes.`,
            errorTitle: 'Too many attempts.',
            errorMessage: `Blocked for ${txConfig.webServer.limiterMinutes} minutes.`,
        }),
        max: txConfig.webServer.limiterAttempts,
        disableHeader: true,
        id: (ctx: any) => ctx.txVars.realIP,
    });

    //Public, content-addressed branding assets.
    router.get('/branding/:kind', routes.branding);
    router.post('/api/link/fivem', authLimiter, routes.cadmin_link);

    //Rendered Pages
    router.get('/legacy/adminManager', webAuthMw, routes.adminManager_page);
    router.get('/legacy/cfgEditor', webAuthMw, routes.cfgEditor_page);
    router.get('/legacy/masterActions', webAuthMw, routes.masterActions_page);
    router.get('/legacy/resources', webAuthMw, routes.resources);
    // FIXME:NEXT:UPDATE rename route handler
    router.get('/legacy/allowlist', webAuthMw, routes.whitelist_page);
    router.get('/legacy/setup', webAuthMw, routes.setup_get);
    router.get('/legacy/deployer', webAuthMw, routes.deployer_stepper);

    //Authentication
    router.get('/auth/self', apiAuthMw, routes.auth_self);
    router.post('/auth/logout', authLimiter, routes.auth_logout);
    router.post('/auth/chyaro/setup', authLimiter, routes.auth_chyaroSetup);
    router.get('/auth/chyaro/login', authLimiter, routes.auth_chyaroLogin);
    router.get('/auth/chyaro/callback', authLimiter, routes.auth_chyaroCallback);

    //Admin Manager
    router.get('/adminManager/data', apiAuthMw, routes.adminManager_data);
    router.post('/adminManager/getModal/:modalType', webAuthMw, routes.adminManager_getModal);
    router.post('/adminManager/:action', apiAuthMw, routes.adminManager_actions);

    //Character Management
    // Keep JSON endpoints away from client-side page URLs. Sharing paths such as
    // `/cadmin/players` made a document refresh hit apiAuthMw without the CSRF
    // header that only authenticated fetches attach.
    router.get('/api/cadmin/ping', apiAuthMw, routes.cadmin_ping);
    router.get('/api/cadmin/overview', apiAuthMw, routes.cadmin_overview);
    router.get('/api/cadmin/players', apiAuthMw, routes.cadmin_players);
    router.get('/api/cadmin/player/:identifier', apiAuthMw, routes.cadmin_player);
    router.post('/api/cadmin/money', apiAuthMw, routes.cadmin_money);
    router.post('/api/cadmin/job', apiAuthMw, routes.cadmin_job);
    router.post('/api/cadmin/group', apiAuthMw, routes.cadmin_group);
    router.get('/api/cadmin/inventory/items', apiAuthMw, routes.cadmin_inventory);
    router.post('/api/cadmin/inventory/give', apiAuthMw, routes.cadmin_inventory);
    router.get('/api/cadmin/garage/:identifier', apiAuthMw, routes.cadmin_garage);
    router.post('/api/cadmin/garage/vehicle', apiAuthMw, routes.cadmin_garage);
    router.get('/api/cadmin/jobs', apiAuthMw, routes.cadmin_jobs);
    router.get('/api/cadmin/users', apiAuthMw, routes.cadmin_users);
    router.post('/api/cadmin/users/:id/:action', apiAuthMw, routes.cadmin_userAction);
    router.post('/api/cadmin/install/:action', apiAuthMw, routes.cadmin_install);

    //Settings
    router.post('/setup/:action', apiAuthMw, routes.setup_post);
    router.get('/deployer/status', apiAuthMw, routes.deployer_status);
    router.post('/deployer/recipe/:action', apiAuthMw, routes.deployer_actions);
    router.get('/settings/configs', apiAuthMw, routes.settings_getConfigs);
    router.post('/settings/configs/:card', apiAuthMw, routes.settings_saveConfigs);
    router.get('/settings/banTemplates', apiAuthMw, routes.settings_getBanTemplates);
    router.post('/settings/banTemplates', apiAuthMw, routes.settings_saveBanTemplates);
    router.post('/settings/resetServerDataPath', apiAuthMw, routes.settings_resetServerDataPath);

    //Master Actions
    router.get('/masterActions/backupDatabase', webAuthMw, routes.masterActions_getBackup);
    router.post('/masterActions/:action', apiAuthMw, routes.masterActions_actions);

    //FXServer
    router.post('/fxserver/controls', apiAuthMw, routes.fxserver_controls);
    router.post('/fxserver/commands', apiAuthMw, routes.fxserver_commands);
    router.get('/fxserver/downloadLog', webAuthMw, routes.fxserver_downloadLog);
    router.post('/fxserver/schedule', apiAuthMw, routes.fxserver_schedule);

    //CFG Editor
    router.get('/cfgEditor/data', apiAuthMw, routes.cfgEditor_data);
    router.post('/cfgEditor/save', apiAuthMw, routes.cfgEditor_save);

    //Control routes
    router.post('/intercom/:scope', intercomAuthMw, routes.intercom);

    //Diagnostic routes
    router.get('/diagnostics/getDiagnostics', apiAuthMw, routes.diagnostics_getDiagnostics);
    router.post('/diagnostics/sendReport', apiAuthMw, routes.diagnostics_sendReport);
    router.post('/advanced/run', apiAuthMw, routes.advanced_runCommand);

    //Data routes
    router.get('/resources/data', apiAuthMw, routes.resources_data);
    router.get('/api/logs/txadmin', apiAuthMw, routes.txAdminLog);
    router.get('/perfChartData/:thread', apiAuthMw, routes.perfChart);
    router.get('/playerDropsData', apiAuthMw, routes.playerDrops);

    //History routes
    router.get('/history/stats', apiAuthMw, routes.history_stats);
    router.get('/history/search', apiAuthMw, routes.history_search);
    router.get('/history/action', apiAuthMw, routes.history_actionModal);
    router.post('/history/:action', apiAuthMw, routes.history_actions);

    //Player routes
    router.get('/player', apiAuthMw, routes.player_modal);
    router.get('/player/stats', apiAuthMw, routes.player_stats);
    router.get('/player/search', apiAuthMw, routes.player_search);
    router.post('/player/checkJoin', intercomAuthMw, routes.player_checkJoin);
    router.post('/player/:action', apiAuthMw, routes.player_actions);
    router.get('/whitelist/:table', apiAuthMw, routes.whitelist_list);
    router.post('/whitelist/:table/:action', apiAuthMw, routes.whitelist_actions);

    //Host routes
    router.get('/host/status', hostAuthMw, routes.host_status);

    //DevDebug routes - no auth
    if (txDevEnv.ENABLED) {
        router.get('/dev/:scope', routes.dev_get);
        router.post('/dev/:scope', routes.dev_post);
    };

    //Insights page mock
    // router.get('/insights', (ctx) => {
    //     return ctx.utils.render('main/insights', { headerTitle: 'Insights' });
    // });

    //Return router
    return router;
};
