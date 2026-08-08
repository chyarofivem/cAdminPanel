-- Qbox adapter.
-- Copyright (c) chyarogroup 2026
--
-- Two things differ from ESX in ways the rest of the resource must not see:
--
--   * The primary key is a citizenid, not a license. The panel keeps that
--     citizenid as the opaque character key; the license is account metadata
--     used only to associate multiple characters with one txAdmin player.
--   * There is no dirty-money account. Qbox servers carry it as an ox_inventory
--     item, so `dirty` reads and writes go through the inventory instead —
--     the item name is CAdminConfig.dirtyMoneyItem.
--
-- qbx_core's permission and money exports have changed shape between releases.
-- The calls here target current qbx_core; each one that is version-sensitive is
-- marked, and offline groups fall back to CAdminConfig.tables.qbGroups.

local util = CAdmin.util
local T = CAdminConfig.tables

local core
local adapter = { id = 'qbox' }

function adapter.detect()
    return GetResourceState('qbx_core') == 'started'
end

function adapter.init()
    core = exports.qbx_core
    return core ~= nil
end

local function decode(value, fallback)
    if type(value) == 'table' then return value end
    if type(value) == 'string' and value ~= '' then
        local decoded = json.decode(value)
        if type(decoded) == 'table' then return decoded end
    end
    return fallback or {}
end

--- Dirty money is an inventory item here, so its balance is a count of that
--- item. ox_inventory answers for online players only; offline the count comes
--- out of the stored inventory blob — and only if this install still keeps one.
--- Servers that hand player inventories to ox_inventory's own table have no
--- `inventory` column, and 0 is the honest answer there rather than an error.
local function dirtyBalance(source, citizenid)
    local item = CAdminConfig.dirtyMoneyItem
    if not item or item == '' then return 0 end

    if source and GetResourceState('ox_inventory') == 'started' then
        local count = exports.ox_inventory:Search(source, 'count', item)
        return tonumber(count) or 0
    end

    if not citizenid then return 0 end
    if not CAdmin.schema.hasColumn(T.qbPlayers, 'inventory') then return 0 end

    local row = MySQL.single.await(
        ('SELECT `inventory` FROM `%s` WHERE citizenid = ? LIMIT 1'):format(T.qbPlayers),
        { citizenid }
    )
    if not row then return 0 end

    local total = 0
    for _, slot in pairs(decode(row.inventory)) do
        if type(slot) == 'table' and slot.name == item then
            total = total + (tonumber(slot.count) or 0)
        end
    end
    return total
end

local function normalizeOnline(player)
    local data = player.PlayerData
    local job = data.job or {}
    return {
        source = data.source,
        name = GetPlayerName(data.source) or
            (((data.charinfo or {}).firstname or '') .. ' ' .. ((data.charinfo or {}).lastname or '')),
        identifier = data.citizenid,
        characterId = data.citizenid,
        playerLicense = data.license,
        citizenid = data.citizenid,
        job = {
            name = job.name,
            label = job.label or job.name,
            grade = (job.grade or {}).level,
            gradeLabel = (job.grade or {}).name
        },
        group = adapter.getGroupBySource(data.source),
        money = {
            cash = (data.money or {}).cash or 0,
            bank = (data.money or {}).bank or 0,
            dirty = dirtyBalance(data.source, data.citizenid)
        },
        online = true
    }
end

local function normalizeOffline(row)
    if not row then return nil end

    local money = decode(row.money)
    local charinfo = decode(row.charinfo)
    local job = decode(row.job)
    local name = row.name
    if not name or name == '' then
        name = string.match(((charinfo.firstname or '') .. ' ' .. (charinfo.lastname or '')), '^%s*(.-)%s*$')
    end

    return {
        source = nil,
        name = (name ~= '' and name) or 'Unknown',
        identifier = row.citizenid,
        characterId = row.citizenid,
        playerLicense = row.license,
        citizenid = row.citizenid,
        job = {
            name = job.name,
            label = job.label or job.name,
            grade = (job.grade or {}).level,
            gradeLabel = (job.grade or {}).name
        },
        group = adapter.getGroupByCitizenId(row.citizenid),
        money = {
            cash = money.cash or 0,
            bank = money.bank or 0,
            dirty = dirtyBalance(nil, row.citizenid)
        },
        online = false
    }
end

-- Columns wanted from `players`, in select order. Which exist is decided at
-- boot: `name` is in Qbox's shipped schema but not on every install, and
-- servers add their own. Anything absent is simply nil on the row, and
-- normalizeOffline already treats every field as optional.
local PLAYER_COLUMNS = { 'citizenid', 'license', 'name', 'money', 'charinfo', 'job' }

-- Columns an offline search matches against. `charinfo` is included because the
-- first and last name live inside that JSON blob, and a LIKE over the raw text
-- is what makes searching by character name work at all.
local SEARCH_COLUMNS = { 'license', 'citizenid', 'name', 'charinfo' }

local playerSelect, searchable

local function resolveColumns()
    if playerSelect then return end

    local list = CAdmin.schema.selectList(T.qbPlayers, PLAYER_COLUMNS)
    if not list then
        error(('The `%s` table has none of the columns Qbox is expected to have. Check CAdminConfig.tables.')
            :format(T.qbPlayers), 0)
    end
    playerSelect = list
    searchable = CAdmin.schema.presentColumns(T.qbPlayers, SEARCH_COLUMNS)
end

function adapter.getOnlinePlayers()
    local out = {}
    for _, playerId in ipairs(GetPlayers()) do
        local player = core:GetPlayer(tonumber(playerId))
        if player then out[#out + 1] = normalizeOnline(player) end
    end
    return out
end

function adapter.getOnlineByIdentifier(identifier)
    for _, playerId in ipairs(GetPlayers()) do
        local player = core:GetPlayer(tonumber(playerId))
        if player and player.PlayerData.citizenid == identifier then return player end
    end
    return nil
end

function adapter.getPlayer(identifier)
    local player = adapter.getOnlineByIdentifier(identifier)
    if player then return normalizeOnline(player) end

    resolveColumns()
    local row = MySQL.single.await(
        ('SELECT %s FROM `%s` WHERE citizenid = ? LIMIT 1'):format(playerSelect, T.qbPlayers),
        { identifier }
    )
    return normalizeOffline(row)
end

--- Account lookup is deliberately plural. A license may own several Qbox
--- characters and choosing one here would recreate the old LIMIT 1 bug.
function adapter.getPlayersByLicense(playerLicense)
    resolveColumns()
    local rows = MySQL.query.await(
        ('SELECT %s FROM `%s` WHERE license = ? ORDER BY `citizenid` LIMIT 50'):format(playerSelect, T.qbPlayers),
        { playerLicense }
    ) or {}

    local byCharacter = {}
    for _, row in ipairs(rows) do
        local normalized = normalizeOffline(row)
        byCharacter[normalized.characterId] = normalized
    end
    for _, playerId in ipairs(GetPlayers()) do
        local player = core:GetPlayer(tonumber(playerId))
        if player and player.PlayerData.license == playerLicense then
            local normalized = normalizeOnline(player)
            byCharacter[normalized.characterId] = normalized
        end
    end

    local out = {}
    for _, player in pairs(byCharacter) do out[#out + 1] = player end
    table.sort(out, function(a, b) return (a.characterId or '') < (b.characterId or '') end)
    return out
end

function adapter.characterIdForSource(source)
    local player = core:GetPlayer(tonumber(source))
    return player and player.PlayerData.citizenid or nil
end

--- The column names in the WHERE come from information_schema, never from the
--- request, so building the clause by concatenation cannot be injected into.
--- The search term itself is always a bound parameter.
function adapter.searchOffline(query)
    resolveColumns()
    if #searchable == 0 then
        error(('The `%s` table has no searchable name or identifier column.'):format(T.qbPlayers), 0)
    end

    local clauses, args = {}, {}
    local like = '%' .. query .. '%'
    for _, column in ipairs(searchable) do
        clauses[#clauses + 1] = ('`%s` LIKE ?'):format(column)
        args[#args + 1] = like
    end

    local orderBy = CAdmin.schema.firstColumn(T.qbPlayers, { 'name', 'citizenid' }) or 'citizenid'

    local rows = MySQL.query.await(
        ('SELECT %s FROM `%s` WHERE %s ORDER BY `%s` LIMIT 50')
            :format(playerSelect, T.qbPlayers, table.concat(clauses, ' OR '), orderBy),
        args
    ) or {}

    local out = {}
    for _, row in ipairs(rows) do out[#out + 1] = normalizeOffline(row) end
    return out
end

function adapter.setMoney(identifier, account, action, amount)
    -- Dirty money is an item, so it is the inventory's problem, not the wallet's.
    if account == 'dirty' then
        return adapter.setDirtyMoney(identifier, action, amount)
    end
    if account ~= 'cash' and account ~= 'bank' then return false, 'Unknown account.' end

    local player = adapter.getOnlineByIdentifier(identifier)
    if player then
        -- Version-sensitive: Player.Functions.{Add,Remove,Set}Money on current qbx_core.
        if action == 'add' then
            player.Functions.AddMoney(account, amount, 'cadminpanel')
        elseif action == 'remove' then
            player.Functions.RemoveMoney(account, amount, 'cadminpanel')
        else
            player.Functions.SetMoney(account, amount, 'cadminpanel')
        end
        return true
    end

    local citizenid = identifier

    local row = MySQL.single.await(
        ('SELECT `money` FROM `%s` WHERE citizenid = ? LIMIT 1'):format(T.qbPlayers),
        { citizenid }
    )
    if not row then return false, 'No such character.' end
    local money = decode(row and row.money)
    local current = money[account] or 0

    if action == 'add' then
        money[account] = current + amount
    elseif action == 'remove' then
        money[account] = math.max(0, current - amount)
    else
        money[account] = amount
    end

    MySQL.update.await(
        ('UPDATE `%s` SET `money` = ? WHERE citizenid = ?'):format(T.qbPlayers),
        { json.encode(money), citizenid }
    )
    return true
end

--- `set` on an item balance means "make the count exactly N", which is a give
--- or a take depending on what is already held.
function adapter.setDirtyMoney(identifier, action, amount)
    local item = CAdminConfig.dirtyMoneyItem
    if not item or item == '' then
        return false, 'No dirty-money item is configured on this server.'
    end

    local player = adapter.getOnlineByIdentifier(identifier)
    if not player then
        -- ox_inventory offers no supported write for an unloaded player, so the
        -- same queue the item-give endpoint uses handles it.
        if action == 'set' then
            return false, 'Dirty money can only be set for an online player on Qbox.'
        end
        if action == 'remove' then
            return false, 'Dirty money can only be taken from an online player on Qbox.'
        end
        if not adapter.characterExists(identifier) then return false, 'No such character.' end
        CAdmin.pending.queue(identifier, item, amount, nil, 'cadminpanel')
        return true, nil, { queued = true }
    end

    local source = player.PlayerData.source
    if action == 'add' then
        exports.ox_inventory:AddItem(source, item, amount)
    elseif action == 'remove' then
        exports.ox_inventory:RemoveItem(source, item, amount)
    else
        local held = tonumber(exports.ox_inventory:Search(source, 'count', item)) or 0
        if amount > held then
            exports.ox_inventory:AddItem(source, item, amount - held)
        elseif amount < held then
            exports.ox_inventory:RemoveItem(source, item, held - amount)
        end
    end
    return true
end

function adapter.setJob(identifier, jobName, grade)
    local player = adapter.getOnlineByIdentifier(identifier)
    if player then
        player.Functions.SetJob(jobName, grade)
        return true
    end

    local citizenid = identifier

    local jobs = adapter.jobTable()
    local job = jobs[jobName]
    if not job then return false, 'Unknown job.' end
    local gradeData = (job.grades or {})[tostring(grade)] or (job.grades or {})[grade] or {}

    local updated = MySQL.update.await(
        ('UPDATE `%s` SET `job` = ? WHERE citizenid = ?'):format(T.qbPlayers),
        {
            json.encode({
                name = jobName,
                label = job.label or jobName,
                onduty = job.defaultDuty or false,
                type = job.type,
                grade = { level = grade, name = gradeData.name or gradeData.label }
            }),
            citizenid
        }
    )
    if not updated or updated == 0 then return false, 'No such character.' end
    return true
end

--- Groups are ACE principals in Qbox, not a column. Online changes go through
--- qbx_core so the principal is live; the row is written either way so the
--- group survives a relog.
function adapter.setGroup(identifier, group)
    local citizenid = identifier

    local player = adapter.getOnlineByIdentifier(identifier)
    if player then
        local source = player.PlayerData.source
        local current = adapter.getGroupBySource(source)
        -- Version-sensitive: qbx_core Add/RemovePermission. Removing first keeps
        -- a demotion from leaving the old, higher principal attached.
        if current and current ~= '' and current ~= group then
            pcall(function() core:RemovePermission(source, current) end)
        end
        pcall(function() core:AddPermission(source, group) end)
    end

    if not CAdmin.schema.ready then
        return false, ('The `%s` table is missing and could not be created. Import sql/cadminpanel.sql.')
            :format(T.qbGroups)
    end

    MySQL.prepare.await(
        ([[INSERT INTO `%s` (citizenid, `group`) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE `group` = VALUES(`group`)]]):format(T.qbGroups),
        { citizenid, group }
    )
    return true
end

function adapter.getGroupBySource(source)
    -- Highest first: a player holding both admin and mod principals is an admin.
    for _, group in ipairs({ 'god', 'superadmin', 'admin', 'mod', 'helper' }) do
        if IsPlayerAceAllowed(source, 'group.' .. group) then return group end
    end
    return 'user'
end

function adapter.getGroupByCitizenId(citizenid)
    if not citizenid then return 'user' end
    -- Offline search calls this once per result, so a missing table here would
    -- fail the whole search rather than one field. It is ours to create, and
    -- schema.ensure() does at boot; if that could not run, 'user' is the same
    -- answer an empty table would give.
    if not CAdmin.schema.ready then return 'user' end

    local row = MySQL.single.await(
        ('SELECT `group` FROM `%s` WHERE citizenid = ? LIMIT 1'):format(T.qbGroups),
        { citizenid }
    )
    return (row and row.group) or 'user'
end

function adapter.getGroup(identifier)
    local player = adapter.getOnlineByIdentifier(identifier)
    if player then return adapter.getGroupBySource(player.PlayerData.source) end
    return adapter.getGroupByCitizenId(identifier)
end

function adapter.jobTable()
    -- Version-sensitive: GetJobs on current qbx_core; older QB exposed
    -- QBCore.Shared.Jobs. An empty table just means the picker offers nothing,
    -- which the panel reports rather than silently accepting any job name.
    local ok, jobs = pcall(function() return core:GetJobs() end)
    if ok and type(jobs) == 'table' then return jobs end
    return {}
end

function adapter.listJobs()
    local out = {}
    for name, job in pairs(adapter.jobTable()) do
        local grades = {}
        for gradeKey, grade in pairs(job.grades or {}) do
            grades[#grades + 1] = {
                grade = tonumber(gradeKey) or 0,
                label = grade.name or grade.label
            }
        end
        table.sort(grades, function(a, b) return (a.grade or 0) < (b.grade or 0) end)
        out[#out + 1] = { name = name, label = job.label or name, grades = grades }
    end
    table.sort(out, function(a, b) return (a.label or '') < (b.label or '') end)
    return out
end

--- Unlike ESX, `vehicle` here is the model name, and `state` is an enum:
--- 0 out, 1 garaged, 2 impounded. Impounded is not "stored" — a vehicle in the
--- impound is not something the player can drive out of a garage.
local VEHICLE_STATE = { [0] = 'Out', [1] = 'Garaged', [2] = 'Impounded' }

-- Wanted from `player_vehicles`, filtered at boot like the player columns.
-- `garage` is not universal and only ever labels the row in the UI.
local VEHICLE_COLUMNS = { 'plate', 'vehicle', 'state', 'garage' }

function adapter.getVehicles(identifier)
    local citizenid = identifier

    local list = CAdmin.schema.selectList(T.qbVehicles, VEHICLE_COLUMNS)
    if not list then return {} end

    local hasState = CAdmin.schema.hasColumn(T.qbVehicles, 'state')
    local rows = MySQL.query.await(
        ('SELECT %s FROM `%s` WHERE citizenid = ? ORDER BY `plate`'):format(list, T.qbVehicles),
        { citizenid }
    ) or {}

    local out = {}
    for _, row in ipairs(rows) do
        local state = tonumber(row.state) or 0
        out[#out + 1] = {
            plate = row.plate,
            model = row.vehicle,
            garage = row.garage,
            stored = hasState and state == 1 or false,
            state = hasState and (VEHICLE_STATE[state] or 'Unknown') or 'Unknown'
        }
    end
    return out
end

function adapter.vehicleExists(identifier, plate)
    local citizenid = identifier
    local row = MySQL.single.await(
        ('SELECT `plate` FROM `%s` WHERE citizenid = ? AND plate = ? LIMIT 1'):format(T.qbVehicles),
        { citizenid, plate }
    )
    return row ~= nil
end

function adapter.plateTaken(plate)
    local row = MySQL.single.await(
        ('SELECT `plate` FROM `%s` WHERE plate = ? LIMIT 1'):format(T.qbVehicles),
        { plate }
    )
    return row ~= nil
end

function adapter.setStored(identifier, plate, stored)
    local citizenid = identifier
    if not CAdmin.schema.hasColumn(T.qbVehicles, 'state') then
        return false, ('The `%s` table has no `state` column.'):format(T.qbVehicles)
    end
    local updated = MySQL.update.await(
        ('UPDATE `%s` SET `state` = ? WHERE citizenid = ? AND plate = ?'):format(T.qbVehicles),
        { stored and 1 or 0, citizenid, plate }
    )
    return updated ~= nil and updated > 0
end

function adapter.setPlate(identifier, plate, newPlate)
    local citizenid = identifier

    -- The plate also lives inside the mods blob the client spawns from, so both
    -- are updated together — but only if this install keeps that column.
    local hasMods = CAdmin.schema.hasColumn(T.qbVehicles, 'mods')

    local row = MySQL.single.await(
        ('SELECT %s FROM `%s` WHERE citizenid = ? AND plate = ? LIMIT 1')
            :format(hasMods and '`mods`' or '`plate`', T.qbVehicles),
        { citizenid, plate }
    )
    if not row then return false, 'That plate is not owned by this character.' end

    if not hasMods then
        MySQL.update.await(
            ('UPDATE `%s` SET `plate` = ? WHERE citizenid = ? AND plate = ?'):format(T.qbVehicles),
            { newPlate, citizenid, plate }
        )
        return true
    end

    local mods = decode(row.mods)
    mods.plate = newPlate

    MySQL.update.await(
        ('UPDATE `%s` SET `plate` = ?, `mods` = ? WHERE citizenid = ? AND plate = ?'):format(T.qbVehicles),
        { newPlate, json.encode(mods), citizenid, plate }
    )
    return true
end

function adapter.deleteVehicle(identifier, plate)
    local citizenid = identifier
    local deleted = MySQL.update.await(
        ('DELETE FROM `%s` WHERE citizenid = ? AND plate = ?'):format(T.qbVehicles),
        { citizenid, plate }
    )
    return deleted ~= nil and deleted > 0
end

function adapter.giveVehicle(identifier, model, plate)
    local citizenid = identifier
    local playerLicense = adapter.playerLicenseForCharacter(citizenid)
    if not playerLicense then return false, 'No such character.' end

    -- Built from the columns this install has: `hash`, `garage` and `license`
    -- are all present on stock Qbox but absent on some forks, and naming one
    -- that is missing fails the whole insert.
    --
    -- `mods` is the ox_lib property table qbx_garages reads back as
    -- `vehicle.props`. It has to be a whole vehicle, not just a plate — the
    -- garage divides props.engineHealth without a nil check and spawns from
    -- props.model. See util.vehicleProps.
    local values = {
        license = playerLicense,
        citizenid = citizenid,
        vehicle = model,
        hash = GetHashKey(model),
        mods = json.encode(util.vehicleProps(model, plate)),
        plate = plate,
        garage = CAdminConfig.defaultGarage,
        state = 1,
        -- Older qb forks keep condition in columns rather than in the blob.
        -- Written when present so both generations agree about the same car.
        fuel = 100,
        engine = 1000.0,
        body = 1000.0,
        depotprice = 0
    }

    local columns, placeholders, args = {}, {}, {}
    for _, column in ipairs({
        'license', 'citizenid', 'vehicle', 'hash', 'mods', 'plate',
        'garage', 'state', 'fuel', 'engine', 'body', 'depotprice'
    }) do
        if CAdmin.schema.hasColumn(T.qbVehicles, column) then
            columns[#columns + 1] = '`' .. column .. '`'
            placeholders[#placeholders + 1] = '?'
            args[#args + 1] = values[column]
        end
    end

    if #columns == 0 then
        return false, ('The `%s` table does not look like a Qbox vehicle table.'):format(T.qbVehicles)
    end

    MySQL.insert.await(
        ('INSERT INTO `%s` (%s) VALUES (%s)')
            :format(T.qbVehicles, table.concat(columns, ', '), table.concat(placeholders, ', ')),
        args
    )
    return true
end

function adapter.characterExists(identifier)
    if adapter.getOnlineByIdentifier(identifier) then return true end
    local row = MySQL.single.await(
        ('SELECT `citizenid` FROM `%s` WHERE citizenid = ? LIMIT 1'):format(T.qbPlayers),
        { identifier }
    )
    return row ~= nil
end

function adapter.playerLicenseForCharacter(identifier)
    local online = adapter.getOnlineByIdentifier(identifier)
    if online then return online.PlayerData.license end
    local row = MySQL.single.await(
        ('SELECT `license` FROM `%s` WHERE citizenid = ? LIMIT 1'):format(T.qbPlayers),
        { identifier }
    )
    return row and row.license or nil
end

--- qbx_core's own permission persistence has moved between releases, so the
--- group recorded in our table is re-applied as an ACE principal when the player
--- loads. Without this, a group set directly from the panel could quietly
--- vanish on relog even though it remains in the local cadmin_groups table.
local function reapplyGroup(src)
    if not CAdmin.bridge or CAdmin.bridge.frameworkName() ~= 'qbox' then return end

    CreateThread(function()
        local citizenid = adapter.characterIdForSource(src)
        if not citizenid then return end

        local stored = adapter.getGroupByCitizenId(citizenid)
        -- 'user' is the absence of a group, not a principal to hand out.
        if not stored or stored == 'user' then return end
        if adapter.getGroupBySource(src) == stored then return end

        pcall(function() core:AddPermission(src, stored) end)
        util.log('Re-applied group "%s" to character %s on load.', stored, citizenid)
    end)
end

RegisterNetEvent('QBCore:Server:PlayerLoaded', function(player)
    local src = type(player) == 'table' and player.PlayerData and player.PlayerData.source
        or tonumber(player) or source
    if src then reapplyGroup(src) end
end)

AddEventHandler('qbx_core:server:playerLoaded', function(player)
    local src = type(player) == 'table' and player.PlayerData and player.PlayerData.source
        or tonumber(player) or source
    if src then reapplyGroup(src) end
end)

CAdmin.frameworks.qbox = adapter
