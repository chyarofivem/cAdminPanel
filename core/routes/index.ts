export { default as intercom } from './intercom.js';
export { default as resources_data } from './resources/data';
export { default as perfChart } from './perfChart';
export { default as playerDrops } from './playerDrops';
export { default as panelLog } from './txAdminLog';
export { default as branding } from './branding';
export { default as cadmin_ping } from './cadmin/ping';
export { default as cadmin_players } from './cadmin/players';
export { default as cadmin_player } from './cadmin/player';
export { default as cadmin_money } from './cadmin/money';
export { default as cadmin_job } from './cadmin/job';
export { default as cadmin_group } from './cadmin/group';
export { default as cadmin_inventory } from './cadmin/inventory';
export { default as cadmin_garage } from './cadmin/garage';
export { default as cadmin_jobs } from './cadmin/jobs';
export { default as cadmin_install } from './cadmin/install';
export { default as cadmin_overview } from './cadmin/overview';

export { default as auth_bootstrapMaster } from './authentication/bootstrapMaster';
export { default as auth_verifyPassword } from './authentication/verifyPassword';
export { default as auth_changePassword } from './authentication/changePassword';
export { default as auth_self } from './authentication/self';
export { default as auth_selfIdentifiers } from './authentication/selfIdentifiers';
export { default as auth_selfPreferences } from './authentication/selfPreferences';
export { default as auth_logout } from './authentication/logout';

export { default as adminManager_data } from './adminManager/data';
export { default as adminManager_actions } from './adminManager/actions';

export { default as cfgEditor_data } from './cfgEditor/data';
export { default as cfgEditor_save } from './cfgEditor/save';

export { default as deployer_data } from './deployer/data';
export { default as deployer_actions } from './deployer/actions';

//FIXME join bantemplates with settings
export { default as settings_getConfigs } from './settings/getConfigs';
export { default as settings_saveConfigs } from './settings/saveConfigs';
export { default as settings_getBanTemplates } from './banTemplates/getBanTemplates';
export { default as settings_saveBanTemplates } from './banTemplates/saveBanTemplates';
export { default as settings_resetServerDataPath } from './settings/resetServerDataPath';

export { default as masterActions_getBackup } from './masterActions/getBackup';
export { default as masterActions_actions } from './masterActions/actions';

export { default as setup_data } from './setup/data';
export { default as setup_post } from './setup/post';

export { default as fxserver_commands } from './fxserver/commands';
export { default as fxserver_controls } from './fxserver/controls';
export { default as fxserver_downloadLog } from './fxserver/downloadLog';
export { default as fxserver_schedule } from './fxserver/schedule';

export { default as history_stats } from './history/stats';
export { default as history_search } from './history/search';
export { default as history_actionModal } from './history/actionModal';
export { default as history_actions } from './history/actions.js';

export { default as player_stats } from './player/stats';
export { default as player_search } from './player/search';
export { default as player_modal } from './player/modal';
export { default as player_actions } from './player/actions';
export { default as player_checkJoin } from './player/checkJoin';

export { default as whitelist_list } from './whitelist/list';
export { default as whitelist_actions } from './whitelist/actions';

export { default as advanced_runCommand } from './advanced/runCommand';

export { default as host_status } from './hostStatus';

export {
    get as dev_get,
    post as dev_post,
} from './devDebug.js';
