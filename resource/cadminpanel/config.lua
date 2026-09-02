-- cAdminPanel resource configuration.
-- Copyright (c) chyarogroup 2026
--
-- Secrets are NOT kept here. The shared secret comes from the `cadmin_api_secret`
-- convar so it never lands in a file that gets committed:
--
--     set cadmin_api_secret "the value the setup wizard generated"
--
-- Everything below is a safe default that most servers never need to touch.

CAdminConfig = {}

-- 'auto' detects es_extended / qbx_core at start. Set it explicitly if you run
-- both resources side by side and only one of them owns your players.
CAdminConfig.framework = GetConvar('cadmin_framework', 'auto')

-- ESX keeps dirty money in a native `black_money` account. Qbox has no such
-- account, so dirty money is an ox_inventory item and this is its name — set it
-- to whatever your server uses (commonly `black_money` or `markedbills`).
CAdminConfig.dirtyMoneyItem = GetConvar('cadmin_dirty_money_item', 'black_money')

-- The panel is the only intended caller, but this port is public: :30120 is the
-- game port. Firewall it, or reverse-proxy /cadminpanel and block the rest.
CAdminConfig.rateLimit = {
    -- Requests allowed per window, per IP. The panel's heaviest page issues
    -- four calls, so this leaves ample headroom for several admins at once.
    max = GetConvarInt('cadmin_rate_limit', 120),
    windowMs = 60000
}

-- Which garage a vehicle granted from the panel is parked in. Qbox stores the
-- garage name on the row, and a name no garage config defines gives the player
-- a car they own but can never see — so if you removed Pillbox, point this at
-- one of your own garages. ESX ignores this: it looks at `stored` instead.
CAdminConfig.defaultGarage = GetConvar('cadmin_default_garage', 'pillboxgarage')

-- Where the panel lives, filled from the panel's "Public panel URL" setting.
-- Nothing in this resource calls out to it; it is exposed here so server
-- scripts can point players or staff at the panel. http or https both work.
CAdminConfig.panelUrl = GetConvar('cadmin_panel_url', '')

-- The name shown to players in chat messages sent by this resource. By default
-- it follows the server name the panel replicates, so players see "<server> Panel"
-- instead of a product name they have no reason to recognise. The innermost
-- fallback stays game-neutral so a RedM server is never branded for FiveM.
CAdminConfig.displayName = GetConvar(
    'cadmin_display_name',
    GetConvar('txAdmin-serverName', 'Server') .. ' Panel'
)

-- Table names, in case your framework install renamed them.
CAdminConfig.tables = {
    esxUsers = 'users',
    esxVehicles = 'owned_vehicles',
    qbPlayers = 'players',
    qbVehicles = 'player_vehicles',
    -- Deliberately NOT qbx_core's own `player_groups`: that table holds jobs and
    -- gangs, keyed on (citizenid, group) with a NOT NULL `type`, so an admin
    -- group written into it would either fail or pile up a row per change.
    -- This is our own table, created by sql/cadminpanel.sql.
    qbGroups = 'cadmin_groups',
    pendingItems = 'cadmin_pending_items'
}

CAdminConfig.version = '1.0.0'

