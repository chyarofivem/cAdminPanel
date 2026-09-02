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
-- qbx_core's money and job exports have changed shape between releases. The
-- calls here target current qbx_core and each version-sensitive one is marked.
-- Groups are the exception: they are written as ACE principals directly, for the
-- reason documented above mutateAce, and persisted in CAdminConfig.tables.qbGroups.

local util = CAdmin.util
local T = CAdminConfig.tables

local core
local adapter = { id = 'qbox' }
local storedGroupCache = {}
local managedGroupBySource = {}
local reapplyGenerationBySource = {}

-- Qbox permissions are ACEs attached to the live player source. The panel's
-- durable value lives in cadmin_groups; these helpers are intentionally kept
-- separate so a failed live ACE mutation can never be reported as a success.
local KNOWN_ADMIN_GROUPS = { 'god', 'superadmin', 'admin', 'mod', 'helper' }

local function errorText(value, fallback)
    if type(value) == 'table' and type(value.message) == 'string' then return value.message end
    if type(value) == 'string' and value ~= '' then return value end
    return fallback
end

-- FXServer only runs a console command from a resource when the ACL permits that
-- resource, so the ACE writes below are refused with "Access denied for command
-- add_principal" until server.cfg grants them. The installer writes those grants,
-- but a copy installed by hand, or a cfg the admin later trimmed, will not have
-- them. Checking first turns a silent no-op into one specific instruction.
local ACL_COMMANDS = { 'add_principal', 'add_ace', 'remove_principal', 'remove_ace' }

local function missingAclCommands()
    local principal = 'resource.' .. GetCurrentResourceName()
    -- Fail open if the runtime does not expose the check: reporting a problem we
    -- cannot actually confirm would block group changes on a server that works.
    -- An ACE object is hierarchical, so a blanket `command` grant answers true
    -- here for each of these without being listed individually.
    if not IsPrincipalAceAllowed then return {}, principal end

    local missing = {}
    for _, command in ipairs(ACL_COMMANDS) do
        if not IsPrincipalAceAllowed(principal, 'command.' .. command) then
            missing[#missing + 1] = command
        end
    end
    return missing, principal
end

--- nil when the ACL is in order, otherwise the message shown in the panel.
local function aclError()
    local missing, principal = missingAclCommands()
    if #missing == 0 then return nil end

    local lines = {}
    for _, command in ipairs(missing) do
        lines[#lines + 1] = ('add_ace %s command.%s allow'):format(principal, command)
    end
    return ('This server has not allowed %s to change ACE permissions, so groups cannot be set. Add to server.cfg and restart:\n%s')
        :format(principal, table.concat(lines, '\n'))
end

-- The principal and ACE object qbx_core itself writes for a permission, so a
-- group granted from the panel is exactly what a `group.admin` check anywhere
-- else on the server already looks for.
local function principalFor(source) return 'player.' .. source end
local function aceFor(group) return 'group.' .. group end

-- Group names reach a console command, so anything that is not a plain
-- identifier is refused here as well as in handlers.lua: a name with a space in
-- it would turn one command into another.
local function isGroupName(group)
    return type(group) == 'string' and string.match(group, '^[%w_%-]+$') ~= nil
end

--- The grant this resource writes, and only that one.
local function hasGroupAce(source, group)
    if not source or not isGroupName(group) or group == 'user' then return false end
    return IsPlayerAceAllowed(source, aceFor(group))
end

--- Whether the player holds the group at all, however it was granted. Older qb
--- configurations allow the bare `admin` object where ox_lib and qbx_core use
--- `group.admin`, and a server.cfg principal counts for as much as ours.
local function hasAceGroup(source, group)
    if not source or not isGroupName(group) or group == 'user' then return false end
    return IsPlayerAceAllowed(source, group) or IsPlayerAceAllowed(source, aceFor(group))
end

--- Writes the principal directly instead of calling qbx_core's AddPermission /
--- RemovePermission. Those are deprecated wrappers whose guards disagree with
--- what they do: both test the bare `admin` ACE while the grant they write is
--- `group.admin`, so RemovePermission returns having touched nothing for the
--- very grant AddPermission made. Demoting an online player through them left
--- the old group live until that player reconnected. The strings below are the
--- ones qbx_core uses, so nothing else on the server can tell the difference.
local function mutateAce(source, group, grant)
    local principal, ace = principalFor(source), aceFor(group)
    if grant then
        ExecuteCommand(('add_principal %s %s'):format(principal, ace))
        ExecuteCommand(('add_ace %s %s allow'):format(principal, ace))
    else
        ExecuteCommand(('remove_ace %s %s allow'):format(principal, ace))
        ExecuteCommand(('remove_principal %s %s'):format(principal, ace))
    end
    -- What qbx_core emits after a permission change of its own. Qbox resources
    -- refresh their cached permissions from these, so a group set in the panel
    -- reaches the game without a relog.
    TriggerClientEvent('QBCore:Client:OnPermissionUpdate', source)
    TriggerEvent('QBCore:Server:OnPermissionUpdate', source)
end

--- Reads the result back rather than trusting the write. The ACL can refuse an
--- ACE command outright, in which case nothing lands and the admin has to be told
--- why. Only the add path waits, because it is the one reported to the admin and
--- both callers run on a thread; a few ticks is a frame or two of slack rather
--- than a timeout.
local function grantAce(source, group)
    mutateAce(source, group, true)

    for _ = 1, 6 do
        if hasGroupAce(source, group) then return true end
        Wait(0)
    end
    -- A refused command is the common cause, so name it rather than sending the
    -- admin to a console they may not be able to read.
    return false, aclError()
        or ('The server did not apply the "%s" ACE. Check the server console.'):format(group)
end

local function sourceNumber(source)
    local value = tonumber(source)
    return value and value > 0 and value or nil
end

local function bareLicense(identifier)
    if type(identifier) ~= 'string' then return nil end
    identifier = string.lower(identifier)
    return string.match(identifier, '^license2?:(%x+)$')
        or string.match(identifier, '^(%x+)$')
end

local function sameLicense(left, right)
    local leftBare = bareLicense(left)
    local rightBare = bareLicense(right)
    return leftBare ~= nil and leftBare == rightBare
end

local function txAdminLicenseForSource(source, fallback)
    source = sourceNumber(source)
    if not source then return fallback end
    -- txAdmin uses the `license` identifier as its player key even when Qbox
    -- persists the preferred `license2` identifier in players. Keep this
    -- account metadata aligned while leaving the citizenid unchanged.
    return GetPlayerIdentifierByType(source, 'license') or fallback
end

local function invalidateReapply(source)
    source = sourceNumber(source)
    if not source then return nil end
    local generation = (reapplyGenerationBySource[source] or 0) + 1
    reapplyGenerationBySource[source] = generation
    return generation
end

-- Remove only the direct player principal cAdmin previously established. The
-- effective ACE may remain true through server.cfg (or another principal), which
-- is expected and must not be treated as permission we own. Nothing here can
-- fail: the console takes the command either way, and an ACE that survives it
-- belongs to someone else.
local function releaseManagedGroup(source)
    source = sourceNumber(source)
    local managed = source and managedGroupBySource[source] or nil
    if not managed then return end

    managedGroupBySource[source] = nil
    if not isGroupName(managed.group) then return end

    mutateAce(source, managed.group, false)
    if hasAceGroup(source, managed.group) then
        util.log('Released cAdmin group "%s" from source %s; an unrelated ACE still grants it.',
            managed.group, source)
    end
end

-- Establishes the direct player.* principal cAdmin owns, replacing whatever it
-- owned for this source before. An already-granted group is left alone rather
-- than removed and re-added, which would blink the permission off for anything
-- watching, and the principal is ours to remove later without touching the
-- inherited ones.
local function applyManagedGroup(source, citizenid, group)
    source = sourceNumber(source)
    if not source or not citizenid or not group or group == 'user' then return true end
    if not isGroupName(group) then
        return false, ('"%s" is not a group name this server can use.'):format(tostring(group))
    end

    local managed = managedGroupBySource[source]
    if managed and (managed.citizenid ~= citizenid or managed.group ~= group) then
        releaseManagedGroup(source)
        managed = nil
    end
    if managed and hasGroupAce(source, group) then return true end

    local granted, grantError = grantAce(source, group)
    if not granted then return false, grantError end
    managedGroupBySource[source] = { citizenid = citizenid, group = group }
    return true
end

local function storedGroupFor(citizenid)
    if not citizenid or not CAdmin.schema.ready then return nil end
    local cached = storedGroupCache[citizenid]
    if cached ~= nil then return cached or nil end

    local row = MySQL.single.await(
        ('SELECT `group` FROM `%s` WHERE citizenid = ? LIMIT 1'):format(T.qbGroups),
        { citizenid }
    )
    storedGroupCache[citizenid] = row and row.group or false
    return row and row.group or nil
end

function adapter.detect()
    return GetResourceState('qbx_core') == 'started'
end

function adapter.init()
    core = exports.qbx_core
    -- Surfaced once at load so the problem is visible before an admin tries a
    -- group change and gets an error they have to go looking for.
    local aclProblem = aclError()
    if aclProblem then util.log('%s', aclProblem) end
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
        playerLicense = txAdminLicenseForSource(data.source, data.license),
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
--- Qbox deployments store license, license2, and bare values in this column.
function adapter.getPlayersByLicense(playerLicense)
    resolveColumns()
    local bare = bareLicense(playerLicense)
    if not bare then return {} end
    local license = 'license:' .. bare
    local license2 = 'license2:' .. bare
    local rows = MySQL.query.await(
        ('SELECT %s FROM `%s` WHERE license IN (?, ?, ?) ORDER BY `citizenid` LIMIT 50'):format(playerSelect, T.qbPlayers),
        { license, license2, bare }
    ) or {}

    local byCharacter = {}
    for _, row in ipairs(rows) do
        local normalized = normalizeOffline(row)
        byCharacter[normalized.characterId] = normalized
    end
    for _, playerId in ipairs(GetPlayers()) do
        local player = core:GetPlayer(tonumber(playerId))
        local source = player and player.PlayerData.source or nil
        local storedLicense = player and player.PlayerData.license or nil
        local liveLicense = source and GetPlayerIdentifierByType(source, 'license') or nil
        local liveLicense2 = source and GetPlayerIdentifierByType(source, 'license2') or nil
        if player and (sameLicense(playerLicense, storedLicense)
            or sameLicense(playerLicense, liveLicense)
            or sameLicense(playerLicense, liveLicense2)) then
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
    -- Current Qbox owns both the primary `job` blob and its multi-job rows.
    -- Its export updates them together for online and offline characters. The
    -- direct SQL path remains only for older Qbox releases without SetJob.
    local called, applied, errorResult = pcall(function()
        return core:SetJob(identifier, jobName, grade)
    end)
    if called then
        if applied then return true end
        return false, errorText(errorResult, 'qbx_core refused the job change.')
    end
    if not string.find(tostring(applied), 'No such export', 1, true) then
        return false, errorText(applied, 'qbx_core could not apply the job change.')
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
    if updated == nil then return false, 'The character job could not be saved.' end
    return true
end

--- Groups are ACE principals in Qbox, not a column. The live principal is
--- rewritten for an online player, and the row is written either way so the
--- group survives a relog, a server restart, or a cadminpanel restart.
function adapter.setGroup(identifier, group)
    local citizenid = identifier

    if not isGroupName(group) then return false, 'That is not a group name this server can use.' end
    if not CAdmin.schema.ready then
        return false, ('The `%s` table is missing and could not be created. Import sql/cadminpanel.sql.')
            :format(T.qbGroups)
    end

    local storedRow = MySQL.single.await(
        ('SELECT `group` FROM `%s` WHERE citizenid = ? LIMIT 1'):format(T.qbGroups),
        { citizenid }
    )
    local previous = storedRow and storedRow.group or nil

    local player = adapter.getOnlineByIdentifier(identifier)
    local source = player and sourceNumber(player.PlayerData.source) or nil
    -- Neither branch below writes an ACE for an offline player, and `user` is the
    -- absence of a group rather than one to grant, so a broken ACL would be stored
    -- as a completed promotion and only surface later, out of sight. Where an ACE
    -- write is attempted, grantAce reports the refusal itself and this predicts
    -- nothing.
    if not source or group == 'user' then
        local aclProblem = aclError()
        if aclProblem then return false, aclProblem end
    end
    if source then
        -- A pending load reconciliation must not overwrite this explicit edit.
        invalidateReapply(source)

        -- Claim the durable previous value before dropping it. The principal is
        -- the same string an earlier run of this resource would have written, so
        -- claiming it is what lets a group granted before a cadminpanel restart
        -- be taken back instead of staying live alongside the new one.
        if isGroupName(previous) and previous ~= group then
            local claimed, claimError = applyManagedGroup(source, citizenid, previous)
            if not claimed then return false, claimError end
        end

        -- Only ever our own player.* grant: an inherited server.cfg principal is
        -- not permission this panel handed out, so it is not ours to revoke.
        local managed = managedGroupBySource[source]
        if managed and (managed.citizenid ~= citizenid or managed.group ~= group) then
            releaseManagedGroup(source)
        end

        if group ~= 'user' then
            local applied, applyError = applyManagedGroup(source, citizenid, group)
            if not applied then
                -- A refused change must not read as a demotion.
                if isGroupName(previous) then applyManagedGroup(source, citizenid, previous) end
                return false, applyError
            end
        end
    end

    local saved, saveResult = pcall(function()
        return MySQL.prepare.await(
            ([[INSERT INTO `%s` (citizenid, `group`) VALUES (?, ?)
               ON DUPLICATE KEY UPDATE `group` = VALUES(`group`)]]):format(T.qbGroups),
            { citizenid, group }
        )
    end)
    if not saved or saveResult == nil then
        -- Keep live and durable state aligned if the database write fails: drop
        -- what was just granted and put back what the table still says.
        if source and group ~= previous then
            releaseManagedGroup(source)
            if isGroupName(previous) then
                local restored, restoreError = applyManagedGroup(source, citizenid, previous)
                if not restored then
                    util.log('Could not restore group "%s" for character %s: %s',
                        previous, citizenid, restoreError)
                end
            end
        end
        return false, ('The group could not be saved: %s')
            :format(errorText(saveResult, 'database error'))
    end
    storedGroupCache[citizenid] = group
    return true
end

function adapter.getGroupBySource(source)
    -- Highest first: a player holding both admin and mod principals is an admin.
    -- Do this before consulting the stored custom value so an externally
    -- inherited higher ACE is never hidden by the panel.
    for _, group in ipairs(KNOWN_ADMIN_GROUPS) do
        if hasAceGroup(source, group) then return group end
    end

    -- Keep custom groups previously assigned through the panel visible too.
    local player = core and core:GetPlayer(tonumber(source)) or nil
    local citizenid = player and player.PlayerData and player.PlayerData.citizenid or nil
    local stored = storedGroupFor(citizenid)
    if stored and hasAceGroup(source, stored) then return stored end
    return 'user'
end

function adapter.getGroupByCitizenId(citizenid)
    if not citizenid then return 'user' end
    -- Offline search calls this once per result, so a missing table here would
    -- fail the whole search rather than one field. It is ours to create, and
    -- schema.ensure() does at boot; if that could not run, 'user' is the same
    -- answer an empty table would give.
    if not CAdmin.schema.ready then return 'user' end

    return storedGroupFor(citizenid) or 'user'
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
    src = sourceNumber(src)
    if not src then return end

    -- Several Qbox compatibility events can fire for one load. The generation
    -- also prevents a DB lookup started for the old character from granting
    -- its group after the same source has already switched characters.
    local generation = invalidateReapply(src)

    CreateThread(function()
        local citizenid = adapter.characterIdForSource(src)
        if not citizenid then return end

        local stored = storedGroupFor(citizenid)
        if reapplyGenerationBySource[src] ~= generation
            or adapter.characterIdForSource(src) ~= citizenid then
            return
        end

        -- Release a grant tracked for the previous character before handling
        -- the new value. Crucially, this happens before a no-row return: an
        -- unmanaged character must not inherit the previous character's live
        -- player.* principal. We never inspect/remove an arbitrary effective
        -- ACE here, so server.cfg groups remain untouched.
        local managed = managedGroupBySource[src]
        if managed and (managed.citizenid ~= citizenid or managed.group ~= stored) then
            releaseManagedGroup(src)
        end

        -- No row is deliberately different from an explicit `user` row only
        -- in durable state. Neither should own a live cAdmin principal.
        if not stored or stored == 'user' then return end

        local applied, applyError = applyManagedGroup(src, citizenid, stored)
        if not applied then
            util.log('Could not re-apply group "%s" to character %s: %s',
                stored, citizenid, applyError)
            return
        end
        util.log('Re-applied group "%s" to character %s on load.', stored, citizenid)
    end)
end

local function lifecycleSource(value)
    if type(value) == 'table' and value.PlayerData then
        return sourceNumber(value.PlayerData.source)
    end
    return sourceNumber(value) or sourceNumber(source)
end

local function cleanupSourceGroup(value)
    local src = lifecycleSource(value)
    if not src then return end
    invalidateReapply(src)
    releaseManagedGroup(src)
end

-- Emitted by qbx_core when it creates the server-side player object. Keep this
-- compatibility event because it exists across old and current Qbox releases.
RegisterNetEvent('QBCore:Server:PlayerLoaded', function(player)
    local src = type(player) == 'table' and player.PlayerData and player.PlayerData.source
        or tonumber(player) or source
    if src then reapplyGroup(src) end
end)

-- Emitted by the Qbox character client once spawning is complete. Some server
-- versions/resources only expose this lifecycle hook to integrations.
RegisterNetEvent('QBCore:Server:OnPlayerLoaded', function()
    local src = source
    if src then reapplyGroup(src) end
end)

AddEventHandler('qbx_core:server:playerLoaded', function(player)
    local src = type(player) == 'table' and player.PlayerData and player.PlayerData.source
        or tonumber(player) or source
    if src then reapplyGroup(src) end
end)

-- Current qbx_core emits this before discarding the player object, but it does
-- not remove source ACE principals itself. Releasing our tracked principal here
-- prevents it leaking to the next character selected on the same source.
AddEventHandler('QBCore:Server:OnPlayerUnload', function(playerSource)
    cleanupSourceGroup(playerSource)
end)

-- Keep the source table clean if a client disconnects without a normal Qbox
-- logout. The direct principal is released while the source still identifies
-- the disconnecting player.
AddEventHandler('playerDropped', function()
    cleanupSourceGroup(source)
end)

-- bridge.lua invokes this after framework and schema initialization. It covers
-- restarting only cadminpanel while players are already online, when no Qbox
-- player-loaded event will fire again.
function adapter.onReady()
    for _, playerId in ipairs(GetPlayers()) do
        local src = tonumber(playerId)
        if src then reapplyGroup(src) end
    end
end

-- qbx_core leaves dynamically added principals alive when only cadminpanel is
-- restarted. Release every principal this instance owns; adapter.onReady()
-- will establish and track the durable groups again after startup.
AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then return end

    local sources = {}
    for src in pairs(managedGroupBySource) do sources[#sources + 1] = src end
    for _, src in ipairs(sources) do releaseManagedGroup(src) end
end)

CAdmin.frameworks.qbox = adapter
