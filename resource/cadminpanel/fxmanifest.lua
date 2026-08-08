fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'cadminpanel'
author 'chyarogroup'
description 'chyarogroup FiveM Admin Panel bridge (cAdminPanel)'
version '1.0.0'
repository 'https://github.com/chyarogroup/cAdminPanel'

shared_script 'config.lua'

client_script 'client/link.lua'

-- Load order matters: the adapters register themselves into CAdmin.frameworks,
-- so bridge.lua must run after both of them and before anything that calls it.
server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/util.lua',
    'server/schema.lua',
    'server/framework/esx.lua',
    'server/framework/qbox.lua',
    'server/framework/bridge.lua',
    'server/pending.lua',
    'server/handlers.lua',
    'server/link.lua',
    'server/main.lua'
}

dependency 'oxmysql'

