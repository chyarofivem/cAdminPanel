-- ESX Legacy adapter.
-- Copyright (c) chyarogroup 2026
--
-- Online work goes through xPlayer so ESX fires its own events and the client
-- sees the change immediately. Offline work goes straight to SQL, because the
-- player object does not exist to be mutated.

local util = CAdmin.util
local T = CAdminConfig.tables

local ESX
local adapter = { id = 'esx' }

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

local function playerLicenseFor(identifier, source)
    -- txAdmin keys players by FiveM's `license` identifier. Prefer that live
    -- value over the framework's character key, which may embed `license2`.
    -- The character key itself remains untouched in characterId/identifier.
    if source then
        local live = GetPlayerIdentifierByType(source, 'license')
        if live then return string.lower(live) end
    end
    if util.isLicense(identifier) then return string.lower(identifier) end
    if type(identifier) == 'string' then
        local embedded = string.match(string.lower(identifier), '(license2?:%x+)$')
        if embedded and util.isLicense(embedded) then return embedded end
    end
    return nil
end

function adapter.detect()
    return GetResourceState('es_extended') == 'started'
end

function adapter.init()
    ESX = exports['es_extended']:getSharedObject()
    return ESX ~= nil
end

-- cash / bank / dirty are the panel's names; these are ESX's.
local ACCOUNTS = { cash = 'money', bank = 'bank', dirty = 'black_money' }

local function money(xPlayer)
    return {
        cash = xPlayer.getAccount('money') and xPlayer.getAccount('money').money or 0,
        bank = xPlayer.getAccount('bank') and xPlayer.getAccount('bank').money or 0,
        dirty = xPlayer.getAccount('black_money') and xPlayer.getAccount('black_money').money or 0
    }
end

local function normalizeOnline(xPlayer)
    local job = xPlayer.getJob() or {}
    return {
        source = xPlayer.source,
        name = GetPlayerName(xPlayer.source) or xPlayer.getName(),
        characterId = xPlayer.identifier,
        playerLicense = playerLicenseFor(xPlayer.identifier, xPlayer.source),
        -- Compatibility alias. Its meaning is now consistently the framework
        -- character key, never the account-level license.
        identifier = xPlayer.identifier,
        job = {
            name = job.name,
            label = job.label or job.name,
            grade = job.grade,
            gradeLabel = job.grade_label
        },
        group = xPlayer.getGroup(),
        money = money(xPlayer),
        online = true
    }
end

--- ESX stores accounts as a JSON object on the user row. Missing keys mean the
--- account was never touched, which is the same thing as zero.
---
--- Every field is read defensively: a live ESX `users` table is rarely vanilla,
--- and a column this resource never confirmed is simply nil on the row.
local function normalizeOffline(row)
    if not row then return nil end

    local accounts = {}
    if row.accounts and row.accounts ~= '' then
        local decoded = json.decode(row.accounts)
        if type(decoded) == 'table' then accounts = decoded end
    end

    local name = row.name
    if not name or name == '' then
        name = ((row.firstname or '') .. ' ' .. (row.lastname or ''))
        name = string.match(name, '^%s*(.-)%s*$')
    end

    return {
        source = nil,
        name = (name ~= '' and name) or 'Unknown',
        characterId = row.identifier,
        playerLicense = playerLicenseFor(row.identifier),
        identifier = row.identifier,
        job = { name = row.job, label = row.job, grade = row.job_grade },
        group = row.group,
        money = {
            cash = accounts.money or 0,
            bank = accounts.bank or 0,
            dirty = accounts.black_money or 0
        },
        online = false
    }
end

-- The columns wanted from `users`, in the order they are selected. Which of
-- these a given server actually has is decided at boot by schema.selectList —
-- `name` in particular is absent on stock ESX Legacy but present once other
-- resources add it, and identity columns vary by install.
local USER_COLUMNS = {
    'identifier', 'accounts', 'job', 'job_grade', 'group',
    'name', 'firstname', 'lastname'
}

-- Columns an offline search matches against, filtered the same way. Searching a
-- column that is not there would take the whole search down with it.
local SEARCH_COLUMNS = { 'identifier', 'name', 'firstname', 'lastname' }

local userSelect, searchable

--- Resolved once, on first use rather than at load: oxmysql is not necessarily
--- connected while the resource's scripts are still being parsed.
local function resolveColumns()
    if userSelect then return end

    local list = CAdmin.schema.selectList(T.esxUsers, USER_COLUMNS)
    if not list then
        error(('The `%s` table has none of the columns ESX is expected to have. Check CAdminConfig.tables.')
            :format(T.esxUsers), 0)
    end
    userSelect = list
    searchable = CAdmin.schema.presentColumns(T.esxUsers, SEARCH_COLUMNS)
end

function adapter.getOnlinePlayers()
    local out = {}
    for _, playerId in ipairs(ESX.GetPlayers()) do
        local xPlayer = ESX.GetPlayerFromId(playerId)
        if xPlayer then out[#out + 1] = normalizeOnline(xPlayer) end
    end
    return out
end

function adapter.getOnlineByIdentifier(identifier)
    for _, playerId in ipairs(ESX.GetPlayers()) do
        local xPlayer = ESX.GetPlayerFromId(playerId)
        if xPlayer and xPlayer.identifier == identifier then return xPlayer end
    end
    return nil
end

function adapter.getPlayer(identifier)
    local xPlayer = adapter.getOnlineByIdentifier(identifier)
    if xPlayer then return normalizeOnline(xPlayer) end

    resolveColumns()
    local row = MySQL.single.await(
        ('SELECT %s FROM `%s` WHERE identifier = ? LIMIT 1'):format(userSelect, T.esxUsers),
        { identifier }
    )
    return normalizeOffline(row)
end

--- Returns every ESX character belonging to a FiveM account. Deployed tables
--- contain bare, license-prefixed, and license2-prefixed values; multichar
--- installs commonly prepend a slot key (for example `char1:license:...`).
--- Match those storage forms while returning each exact identifier unchanged.
function adapter.getPlayersByLicense(playerLicense)
    resolveColumns()
    local bare = bareLicense(playerLicense)
    if not bare then return {} end
    local license = 'license:' .. bare
    local license2 = 'license2:' .. bare
    local rows = MySQL.query.await(
        ('SELECT %s FROM `%s` '
            .. 'WHERE identifier IN (?, ?, ?) '
            .. 'OR identifier LIKE ? OR identifier LIKE ? OR identifier LIKE ? '
            .. 'ORDER BY `identifier` LIMIT 50')
            :format(userSelect, T.esxUsers),
        { license, license2, bare, '%:' .. license, '%:' .. license2, '%:' .. bare }
    ) or {}

    local byCharacter = {}
    for _, row in ipairs(rows) do
        local normalized = normalizeOffline(row)
        byCharacter[normalized.characterId] = normalized
    end
    for _, playerId in ipairs(ESX.GetPlayers()) do
        local xPlayer = ESX.GetPlayerFromId(playerId)
        if xPlayer then
            local normalized = normalizeOnline(xPlayer)
            local liveLicense2 = GetPlayerIdentifierByType(xPlayer.source, 'license2')
            if sameLicense(playerLicense, normalized.playerLicense)
                or sameLicense(playerLicense, liveLicense2) then
                byCharacter[normalized.characterId] = normalized
            end
        end
    end

    local out = {}
    for _, player in pairs(byCharacter) do out[#out + 1] = player end
    table.sort(out, function(a, b) return (a.characterId or '') < (b.characterId or '') end)
    return out
end

function adapter.characterIdForSource(source)
    local xPlayer = ESX.GetPlayerFromId(source)
    return xPlayer and xPlayer.identifier or nil
end

--- Offline search. The wildcard is bound as a parameter rather than pasted into
--- the statement, so a query full of quotes is just a search that finds nothing.
---
--- The column names in the WHERE come from information_schema, never from the
--- request, so building the clause by concatenation cannot be injected into.
function adapter.searchOffline(query)
    resolveColumns()
    if #searchable == 0 then
        error(('The `%s` table has no searchable name or identifier column.'):format(T.esxUsers), 0)
    end

    local clauses, args = {}, {}
    local like = '%' .. query .. '%'
    for _, column in ipairs(searchable) do
        clauses[#clauses + 1] = ('`%s` LIKE ?'):format(column)
        args[#args + 1] = like
    end

    -- Ordered by whichever name column exists; by identifier when none does, so
    -- the list is at least stable between searches.
    local orderBy = CAdmin.schema.firstColumn(T.esxUsers, { 'lastname', 'name', 'identifier' }) or 'identifier'

    local rows = MySQL.query.await(
        ('SELECT %s FROM `%s` WHERE %s ORDER BY `%s` LIMIT 50')
            :format(userSelect, T.esxUsers, table.concat(clauses, ' OR '), orderBy),
        args
    ) or {}

    local out = {}
    for _, row in ipairs(rows) do out[#out + 1] = normalizeOffline(row) end
    return out
end

function adapter.setMoney(identifier, account, action, amount)
    local esxAccount = ACCOUNTS[account]
    if not esxAccount then return false, 'Unknown account.' end

    local xPlayer = adapter.getOnlineByIdentifier(identifier)
    if xPlayer then
        if action == 'add' then
            xPlayer.addAccountMoney(esxAccount, amount)
        elseif action == 'remove' then
            xPlayer.removeAccountMoney(esxAccount, amount)
        else
            xPlayer.setAccountMoney(esxAccount, amount)
        end
        return true
    end

    if not CAdmin.schema.hasColumn(T.esxUsers, 'accounts') then
        return false, ('The `%s` table has no `accounts` column, so offline money cannot be changed.')
            :format(T.esxUsers)
    end

    local row = MySQL.single.await(
        ('SELECT `accounts` FROM `%s` WHERE identifier = ? LIMIT 1'):format(T.esxUsers),
        { identifier }
    )
    if not row then return false, 'No such character.' end

    local accounts = {}
    if row.accounts and row.accounts ~= '' then
        local decoded = json.decode(row.accounts)
        if type(decoded) == 'table' then accounts = decoded end
    end

    local current = accounts[esxAccount] or 0
    if action == 'add' then
        accounts[esxAccount] = current + amount
    elseif action == 'remove' then
        -- Clamped at zero: ESX has no concept of a negative account and a
        -- negative balance breaks the client HUD rather than showing a debt.
        accounts[esxAccount] = math.max(0, current - amount)
    else
        accounts[esxAccount] = amount
    end

    MySQL.update.await(
        ('UPDATE `%s` SET `accounts` = ? WHERE identifier = ?'):format(T.esxUsers),
        { json.encode(accounts), identifier }
    )
    return true
end

function adapter.setJob(identifier, jobName, grade)
    local xPlayer = adapter.getOnlineByIdentifier(identifier)
    if xPlayer then
        local previous = xPlayer.getJob() or {}
        xPlayer.setJob(jobName, grade)

        -- ESX normally persists this on its next save tick/drop. Writing the
        -- row now makes a panel change durable even if the server restarts
        -- before that tick, while setJob above still updates live state/events.
        local saved, updated = pcall(function()
            return MySQL.update.await(
                ('UPDATE `%s` SET `job` = ?, `job_grade` = ? WHERE identifier = ?'):format(T.esxUsers),
                { jobName, grade, identifier }
            )
        end)
        if not saved or updated == nil then
            if previous.name then pcall(xPlayer.setJob, previous.name, previous.grade or 0) end
            return false, 'The job changed live but could not be saved to the ESX users table.'
        end
        return true
    end

    local updated = MySQL.update.await(
        ('UPDATE `%s` SET `job` = ?, `job_grade` = ? WHERE identifier = ?'):format(T.esxUsers),
        { jobName, grade, identifier }
    )
    -- The handler already verified that the character exists. Affected rows can
    -- legitimately be zero when the requested job is already set.
    if updated == nil then return false, 'The character job could not be saved.' end
    return true
end

function adapter.setGroup(identifier, group)
    if not CAdmin.schema.hasColumn(T.esxUsers, 'group') then
        return false, ('The `%s` table has no `group` column, so the group cannot be persisted.')
            :format(T.esxUsers)
    end

    local xPlayer = adapter.getOnlineByIdentifier(identifier)
    if xPlayer then
        local previous = xPlayer.getGroup()
        xPlayer.setGroup(group)

        -- xPlayer.setGroup updates ACEs and state bags but current ESX defers
        -- the database write until its save cycle. Persist immediately so a
        -- restart cannot revert a panel assignment.
        local saved, updated = pcall(function()
            return MySQL.update.await(
                ('UPDATE `%s` SET `group` = ? WHERE identifier = ?'):format(T.esxUsers),
                { group, identifier }
            )
        end)
        if not saved or updated == nil then
            if previous then pcall(xPlayer.setGroup, previous) end
            return false, 'The group changed live but could not be saved to the ESX users table.'
        end
        return true
    end

    local updated = MySQL.update.await(
        ('UPDATE `%s` SET `group` = ? WHERE identifier = ?'):format(T.esxUsers),
        { group, identifier }
    )
    if updated == nil then return false, 'The character group could not be saved.' end
    return true
end

function adapter.getGroup(identifier)
    local xPlayer = adapter.getOnlineByIdentifier(identifier)
    if xPlayer then return xPlayer.getGroup() end

    if not CAdmin.schema.hasColumn(T.esxUsers, 'group') then return nil end

    local row = MySQL.single.await(
        ('SELECT `group` FROM `%s` WHERE identifier = ? LIMIT 1'):format(T.esxUsers),
        { identifier }
    )
    return row and row.group or nil
end

function adapter.listJobs()
    local out = {}
    for name, job in pairs(ESX.GetJobs() or {}) do
        local grades = {}
        for gradeKey, grade in pairs(job.grades or {}) do
            grades[#grades + 1] = {
                grade = tonumber(gradeKey) or grade.grade,
                label = grade.label or grade.name
            }
        end
        table.sort(grades, function(a, b) return (a.grade or 0) < (b.grade or 0) end)
        out[#out + 1] = { name = name, label = job.label or name, grades = grades }
    end
    table.sort(out, function(a, b) return (a.label or '') < (b.label or '') end)
    return out
end

--- ESX's `vehicle` column is a props blob, not a model name — the only thing in
--- it a server can read is the model hash. The panel falls back to the plate
--- when there is no readable name, so a hash is passed through rather than
--- guessed at.
function adapter.getVehicles(identifier)
    -- `stored` is the vanilla column but not every install keeps it; without it
    -- the state is reported as unknown rather than the query failing.
    local hasStored = CAdmin.schema.hasColumn(T.esxVehicles, 'stored')
    local rows = MySQL.query.await(
        ('SELECT `plate`, `vehicle`%s FROM `%s` WHERE owner = ? ORDER BY `plate`')
            :format(hasStored and ', `stored`' or '', T.esxVehicles),
        { identifier }
    ) or {}

    local out = {}
    for _, row in ipairs(rows) do
        local model
        if row.vehicle and row.vehicle ~= '' then
            local props = json.decode(row.vehicle)
            if type(props) == 'table' and props.model then model = tostring(props.model) end
        end

        local stored = row.stored == 1 or row.stored == true
        out[#out + 1] = {
            plate = row.plate,
            model = model,
            stored = stored,
            state = (not hasStored and 'Unknown') or (stored and 'Garaged' or 'Out')
        }
    end
    return out
end

function adapter.vehicleExists(identifier, plate)
    local row = MySQL.single.await(
        ('SELECT `plate` FROM `%s` WHERE owner = ? AND plate = ? LIMIT 1'):format(T.esxVehicles),
        { identifier, plate }
    )
    return row ~= nil
end

function adapter.plateTaken(plate)
    local row = MySQL.single.await(
        ('SELECT `plate` FROM `%s` WHERE plate = ? LIMIT 1'):format(T.esxVehicles),
        { plate }
    )
    return row ~= nil
end

function adapter.setStored(identifier, plate, stored)
    if not CAdmin.schema.hasColumn(T.esxVehicles, 'stored') then
        return false, ('The `%s` table has no `stored` column.'):format(T.esxVehicles)
    end
    local updated = MySQL.update.await(
        ('UPDATE `%s` SET `stored` = ? WHERE owner = ? AND plate = ?'):format(T.esxVehicles),
        { stored and 1 or 0, identifier, plate }
    )
    return updated ~= nil and updated > 0
end

function adapter.setPlate(identifier, plate, newPlate)
    -- The plate lives in two places: its own column and the props blob the
    -- client spawns from. Updating only the column leaves a car that spawns
    -- with the old plate and is then unfindable by the garage.
    local row = MySQL.single.await(
        ('SELECT `vehicle` FROM `%s` WHERE owner = ? AND plate = ? LIMIT 1'):format(T.esxVehicles),
        { identifier, plate }
    )
    if not row then return false, 'That plate is not owned by this character.' end

    local props = {}
    if row.vehicle and row.vehicle ~= '' then
        local decoded = json.decode(row.vehicle)
        if type(decoded) == 'table' then props = decoded end
    end
    props.plate = newPlate

    MySQL.update.await(
        ('UPDATE `%s` SET `plate` = ?, `vehicle` = ? WHERE owner = ? AND plate = ?'):format(T.esxVehicles),
        { newPlate, json.encode(props), identifier, plate }
    )
    return true
end

function adapter.deleteVehicle(identifier, plate)
    local deleted = MySQL.update.await(
        ('DELETE FROM `%s` WHERE owner = ? AND plate = ?'):format(T.esxVehicles),
        { identifier, plate }
    )
    return deleted ~= nil and deleted > 0
end

function adapter.giveVehicle(identifier, model, plate)
    -- Only columns this install actually has are named. `type`, `job` and
    -- `stored` are vanilla ESX but not universal, and naming an absent one would
    -- fail the insert outright.
    --
    -- `vehicle` is the property blob garage scripts restore the car from, so it
    -- describes a whole pristine vehicle rather than just a plate — the same
    -- reason spelled out over util.vehicleProps.
    local values = {
        owner = identifier,
        plate = plate,
        vehicle = json.encode(util.vehicleProps(model, plate)),
        type = 'car',
        -- Stored, so it appears in the player's garage rather than being spawned
        -- into the world next to whoever happens to be standing there.
        stored = 1
    }

    local columns, placeholders, args = {}, {}, {}
    for _, column in ipairs({ 'owner', 'plate', 'vehicle', 'type', 'stored' }) do
        if values[column] ~= nil and CAdmin.schema.hasColumn(T.esxVehicles, column) then
            columns[#columns + 1] = '`' .. column .. '`'
            placeholders[#placeholders + 1] = '?'
            args[#args + 1] = values[column]
        end
    end

    if #columns == 0 then
        return false, ('The `%s` table does not look like an ESX vehicle table.'):format(T.esxVehicles)
    end

    MySQL.insert.await(
        ('INSERT INTO `%s` (%s) VALUES (%s)')
            :format(T.esxVehicles, table.concat(columns, ', '), table.concat(placeholders, ', ')),
        args
    )
    return true
end

function adapter.characterExists(identifier)
    local row = MySQL.single.await(
        ('SELECT `identifier` FROM `%s` WHERE identifier = ? LIMIT 1'):format(T.esxUsers),
        { identifier }
    )
    return row ~= nil
end

CAdmin.frameworks.esx = adapter
