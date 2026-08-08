-- Our own tables, created at boot.
-- Copyright (c) chyarogroup 2026
--
-- sql/cadminpanel.sql still ships and is still the documented import, but a
-- forgotten import used to surface as "the table doesn't exist" from inside an
-- offline search — an error about our bookkeeping, blamed on the framework.
--
-- These two tables are ours alone: nothing else reads them, so creating them
-- here is not a migration of anyone else's schema. The statements are the same
-- CREATE TABLE IF NOT EXISTS as the file, so running both is harmless.
--
-- No framework table is ever created or altered. If `users` or `players` is
-- missing, that is a broken framework install and the panel says so rather than
-- inventing a table for it to fail against later.

local util = CAdmin.util
local T = CAdminConfig.tables

local schema = { ready = false }

local STATEMENTS = {
    pendingItems = ([[
        CREATE TABLE IF NOT EXISTS `%s` (
            -- Framework character key (Qbox citizenid / ESX identifier), not
            -- the account-level FiveM license.
            `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `identifier` VARCHAR(128) NOT NULL,
            `item`       VARCHAR(64)  NOT NULL,
            `count`      INT UNSIGNED NOT NULL DEFAULT 1,
            `metadata`   TEXT         NULL DEFAULT NULL,
            `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `created_by` VARCHAR(64)  NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_cadmin_pending_identifier` (`identifier`)
        ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
    ]]):format(T.pendingItems),

    groups = ([[
        CREATE TABLE IF NOT EXISTS `%s` (
            `citizenid`  VARCHAR(50) NOT NULL,
            `group`      VARCHAR(50) NOT NULL DEFAULT 'user',
            `updated_at` TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`citizenid`)
        ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
    ]]):format(T.qbGroups)
}

--- True when the table exists in the database this connection is using.
--- information_schema is asked rather than SELECTing from the table, so a
--- missing table is an answer instead of an error in the console.
function schema.tableExists(name)
    local row = MySQL.single.await([[
        SELECT 1 AS present
        FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = ?
        LIMIT 1
    ]], { name })
    return row ~= nil
end

--- Called once at boot. Failure is logged and not fatal: the panel's own
--- features degrade with a clear message, and a server whose MySQL user cannot
--- CREATE should not be stopped from running everything else.
function schema.ensure()
    for _, sql in pairs(STATEMENTS) do
        local ok, err = pcall(function() return MySQL.query.await(sql) end)
        if not ok then
            util.log('Could not create a cAdminPanel table: %s', tostring(err))
            util.log('Import sql/cadminpanel.sql by hand, or grant the MySQL user CREATE.')
            return false
        end
    end
    schema.ready = true
    return true
end

--- The framework tables the adapters read. Checked at boot so a renamed table
--- is reported once, by name, instead of once per request from inside a query.
function schema.checkFramework(frameworkName)
    local required = frameworkName == 'esx'
        and { T.esxUsers, T.esxVehicles }
        or { T.qbPlayers, T.qbVehicles }

    local missing = {}
    for _, name in ipairs(required) do
        if not schema.tableExists(name) then missing[#missing + 1] = name end
    end

    if #missing > 0 then
        util.log('WARNING: %s table(s) not found: %s.', frameworkName, table.concat(missing, ', '))
        util.log('If your install renamed them, set the names in CAdminConfig.tables (config.lua).')
    end
    return missing
end

-- ---------------------------------------------------------------------------
-- Column introspection
-- ---------------------------------------------------------------------------
--
-- Real ESX and Qbox databases are not vanilla. Columns get added by other
-- resources, and some the docs describe are simply absent — the ESX `users`
-- table on a live server has no `name`, and a Qbox `players` may or may not.
--
-- So the adapters no longer name columns they have not confirmed. Each asks for
-- the ones it wants, gets back only those that exist, and builds its SELECT from
-- that. A missing column becomes a field the panel shows as unknown, which is
-- what it is, instead of a query that errors and takes the whole search with it.

local columnCache = {}

--- Every column on a table, lowercased, as a set. Cached: this is asked once per
--- table per boot, and the schema does not change while the server runs.
function schema.columns(table_)
    if columnCache[table_] then return columnCache[table_] end

    local rows = MySQL.query.await([[
        SELECT LOWER(column_name) AS name
        FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ?
    ]], { table_ }) or {}

    local set = {}
    for _, row in ipairs(rows) do set[row.name] = true end

    -- Only cached once the table is actually there. Caching an empty set for a
    -- table created a moment later would keep it looking missing until restart.
    if next(set) then columnCache[table_] = set end
    return set
end

function schema.hasColumn(table_, column)
    return schema.columns(table_)[string.lower(column)] == true
end

--- Of `wanted`, the ones that exist. Order is preserved so the generated SELECT
--- reads the same way every boot.
function schema.presentColumns(table_, wanted)
    local present = schema.columns(table_)
    local out = {}
    for _, column in ipairs(wanted) do
        if present[string.lower(column)] then out[#out + 1] = column end
    end
    return out
end

--- A backtick-quoted select list, so reserved words like `group` are safe.
--- Returns nil when none of the wanted columns exist, which the caller reports
--- as a misconfigured table rather than sending `SELECT FROM`.
function schema.selectList(table_, wanted)
    local present = schema.presentColumns(table_, wanted)
    if #present == 0 then return nil end

    local quoted = {}
    for i, column in ipairs(present) do quoted[i] = '`' .. column .. '`' end
    return table.concat(quoted, ', '), present
end

--- The first of `candidates` that exists on the table. Used where two schemas
--- disagree on a name rather than on whether the column is there at all.
function schema.firstColumn(table_, candidates)
    local present = schema.columns(table_)
    for _, column in ipairs(candidates) do
        if present[string.lower(column)] then return column end
    end
    return nil
end

CAdmin.schema = schema
