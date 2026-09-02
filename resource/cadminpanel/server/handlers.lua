-- Endpoint implementations.
-- Copyright (c) chyarogroup 2026
--
-- Each handler receives (fw, body, params, res) and either returns a value the
-- router wraps as { ok = true, data = ... }, or calls error() with a message the
-- panel shows the admin verbatim. Everything runs inside a coroutine, so the
-- oxmysql `.await` calls below are safe.
--
-- Validation is duplicated here even though the panel validates too: the panel
-- is one caller of a public port, not a gate in front of it.

local util = CAdmin.util
local handlers = {}

local MAX_MONEY = 999999999
local MAX_ITEM_COUNT = 10000
local MONEY_ACCOUNTS = { cash = true, bank = true, dirty = true }
local MONEY_ACTIONS = { add = true, remove = true, set = true }
local PLATE_PATTERN = '^[A-Z0-9 ]+$'

local function requireCharacterId(body)
    local identifier = util.str(body.identifier, 128)
    if not identifier then error('No identifier given.', 0) end
    if not util.isCharacterId(identifier) then error('That is not a valid character identifier.', 0) end
    return identifier
end

local function requirePlate(value, label)
    local plate = util.str(value, 8)
    if not plate then error((label or 'Plate') .. ' is required, 8 characters or fewer.', 0) end
    plate = string.upper(plate)
    if not string.match(plate, PLATE_PATTERN) then
        error((label or 'Plate') .. ' may only contain letters, digits and spaces.', 0)
    end
    return plate
end

-- GET /ping — the wizard's Test connection, and the dashboard's status card.
--
-- `schema` is reported here so a database problem is visible on the screen that
-- exists to find problems, rather than only in the game server console. Both
-- fields are answers, not errors: `ok` false means our own two tables could not
-- be created, and `missingTables` names framework tables that are not there
-- under the configured names.
function handlers.ping(fw)
    local schema = CAdmin.bridge.schemaState()
    return {
        framework = CAdmin.bridge.frameworkName(),
        oxInventory = GetResourceState('ox_inventory') == 'started',
        version = CAdminConfig.version,
        players = #GetPlayers(),
        maxPlayers = GetConvarInt('sv_maxclients', 48),
        dirtyMoneyItem = CAdminConfig.dirtyMoneyItem,
        schema = {
            checked = schema.checked,
            ok = schema.ok,
            -- json.encode turns an empty Lua table into {}, not [], and the
            -- panel expects a list. nil is unambiguous: nothing to report.
            missingTables = #schema.missing > 0 and schema.missing or nil
        }
    }
end

function handlers.players(fw)
    return fw.getOnlinePlayers()
end

function handlers.playersSearch(fw, _, params)
    local query = util.str(params.q, 64)
    if not query then error('Enter something to search for.', 0) end
    if #query < 2 then error('Search for at least two characters.', 0) end
    return fw.searchOffline(query)
end

--- Account-to-character lookup is plural by design. A FiveM license identifies
--- the txAdmin player account, not a Qbox character, and must never be resolved
--- with LIMIT 1 when several citizen IDs share it.
function handlers.characters(fw, _, _, _, playerLicense)
    if not util.isLicense(playerLicense) then error('That is not a FiveM license identifier.', 0) end
    return fw.getPlayersByLicense(playerLicense)
end

--- The panel's player page in one call: profile, held items and owned vehicles.
--- Three round trips over a WAN link would be three chances to time out.
function handlers.player(fw, _, _, _, identifier)
    if not util.isCharacterId(identifier) then error('That is not a valid character identifier.', 0) end

    local player = fw.getPlayer(identifier)
    if not player then error('No character on this server has that identifier.', 0) end

    player.inventory = handlers.inventoryOf(fw, player)
    player.vehicles = fw.getVehicles(identifier)
    player.pendingItems = CAdmin.pending.countFor(identifier)
    return player
end

--- Only readable for an online player: ox_inventory answers for a live
--- inventory, and the stored blob is its private format. An empty list is
--- honest here — the panel labels the panel "slots in use", not "owns nothing".
function handlers.inventoryOf(fw, player)
    if not player.online or not player.source then return {} end
    if GetResourceState('ox_inventory') ~= 'started' then return {} end

    local ok, items = pcall(function()
        return exports.ox_inventory:GetInventoryItems(player.source)
    end)
    if not ok or type(items) ~= 'table' then return {} end

    local registry = exports.ox_inventory:Items() or {}
    local out = {}
    for _, item in pairs(items) do
        if type(item) == 'table' and item.name then
            out[#out + 1] = {
                name = item.name,
                label = (registry[item.name] or {}).label or item.name,
                count = item.count,
                slot = item.slot,
                metadata = item.metadata
            }
        end
    end
    table.sort(out, function(a, b) return (a.slot or 0) < (b.slot or 0) end)
    return out
end

function handlers.jobs(fw)
    return fw.listJobs()
end

function handlers.items()
    if GetResourceState('ox_inventory') ~= 'started' then
        error('ox_inventory is not running on this server.', 0)
    end

    local out = {}
    for name, item in pairs(exports.ox_inventory:Items() or {}) do
        out[#out + 1] = { name = name, label = item.label or name, weight = item.weight }
    end
    table.sort(out, function(a, b) return (a.label or '') < (b.label or '') end)
    return out
end

function handlers.money(fw, body)
    local identifier = requireCharacterId(body)
    local account = util.str(body.account, 16)
    local action = util.str(body.action, 16)
    local amount = util.int(body.amount, 0, MAX_MONEY)

    if not account or not MONEY_ACCOUNTS[account] then error('Unknown account.', 0) end
    if not action or not MONEY_ACTIONS[action] then error('Unknown action.', 0) end
    if not amount then error('Amount must be a whole number between 0 and ' .. MAX_MONEY .. '.', 0) end

    local ok, err, extra = fw.setMoney(identifier, account, action, amount)
    if not ok then error(err or 'The money change did not apply.', 0) end

    util.log('%s %s %d %s', action, identifier, amount, account)
    return extra or { applied = true }
end

function handlers.job(fw, body)
    local identifier = requireCharacterId(body)
    local jobName = util.str(body.job, 64)
    local grade = util.int(body.grade, 0, 100)

    if not jobName then error('No job given.', 0) end
    if not grade then error('Grade must be a whole number.', 0) end

    -- Checked against the server's own job list so a typo cannot leave a
    -- character holding a job that does not exist.
    local found
    for _, job in ipairs(fw.listJobs()) do
        if job.name == jobName then found = job break end
    end
    if not found then error(('"%s" is not a job on this server.'):format(jobName), 0) end

    local gradeExists = false
    for _, g in ipairs(found.grades or {}) do
        if g.grade == grade then gradeExists = true break end
    end
    if not gradeExists then
        error(('Grade %d does not exist on %s.'):format(grade, found.label or jobName), 0)
    end

    local ok, err = fw.setJob(identifier, jobName, grade)
    if not ok then error(err or 'The job change did not apply.', 0) end

    util.log('job %s -> %s (%d)', identifier, jobName, grade)
    return { applied = true }
end

-- Direct group management from the panel; panel permissions never reach here.
function handlers.group(fw, body)
    local identifier = requireCharacterId(body)
    local group = util.str(body.group, 32)
    if not group then error('No group given.', 0) end
    if not string.match(group, '^[%w_%-]+$') then
        error('A group may only contain letters, digits, dashes and underscores.', 0)
    end

    if not fw.characterExists(identifier) then
        error('No character on this server has that identifier.', 0)
    end

    local ok, err = fw.setGroup(identifier, group)
    if not ok then error(err or 'The group change did not apply.', 0) end

    util.log('group %s -> %s', identifier, group)
    -- What the character effectively holds now, which is not always what was
    -- saved: on Qbox a group granted by server.cfg is not this panel's to
    -- revoke, so a demotion that leaves an inherited ACE principal in place is
    -- reported back rather than hidden behind a success message.
    local effective = fw.getGroup and fw.getGroup(identifier) or nil
    return { applied = true, group = group, effective = effective or group }
end

function handlers.giveItem(fw, body)
    local identifier = requireCharacterId(body)
    local item = util.str(body.item, 64)
    local count = util.int(body.count, 1, MAX_ITEM_COUNT)

    if not item then error('No item given.', 0) end
    if not count then error('Count must be a whole number between 1 and ' .. MAX_ITEM_COUNT .. '.', 0) end
    if GetResourceState('ox_inventory') ~= 'started' then
        error('ox_inventory is not running on this server.', 0)
    end

    local registry = exports.ox_inventory:Items() or {}
    if not registry[item] then
        error(('"%s" is not registered in ox_inventory on this server.'):format(item), 0)
    end

    local metadata = type(body.metadata) == 'table' and body.metadata or nil

    local player = fw.getOnlineByIdentifier(identifier)
    if not player then
        if not fw.characterExists(identifier) then
            error('No character on this server has that identifier.', 0)
        end
        CAdmin.pending.queue(identifier, item, count, metadata, 'cadminpanel')
        return { queued = true }
    end

    local source = fw.id == 'esx' and player.source or player.PlayerData.source
    local added = exports.ox_inventory:AddItem(source, item, count, metadata)
    if not added then
        error('ox_inventory refused the item — the player may be out of space.', 0)
    end

    util.log('gave %dx %s to %s', count, item, identifier)
    return { applied = true }
end

function handlers.garage(fw, _, _, _, identifier)
    if not util.isCharacterId(identifier) then error('That is not a valid character identifier.', 0) end
    return fw.getVehicles(identifier)
end

function handlers.vehicle(fw, body)
    local identifier = requireCharacterId(body)
    local action = util.str(body.action, 16)
    if not action then error('No action given.', 0) end

    if action == 'give' then
        local model = util.str(body.model, 64)
        if not model then error('No vehicle model given.', 0) end
        if not string.match(model, '^[%w_%-]+$') then
            error('A vehicle model may only contain letters, digits, dashes and underscores.', 0)
        end
        if not fw.characterExists(identifier) then
            error('No character on this server has that identifier.', 0)
        end

        local plate = body.plate and requirePlate(body.plate) or nil
        if plate then
            if fw.plateTaken(plate) then error(('Plate "%s" is already on another vehicle.'):format(plate), 0) end
        else
            plate = handlers.generatePlate(fw)
            if not plate then error('Could not find a free plate to assign.', 0) end
        end

        local ok, err = fw.giveVehicle(identifier, model, plate)
        if not ok then error(err or 'The vehicle was not created.', 0) end

        util.log('gave vehicle %s (%s) to %s', model, plate, identifier)
        return { applied = true, plate = plate }
    end

    local plate = requirePlate(body.plate)
    if not fw.vehicleExists(identifier, plate) then
        error(('This character does not own a vehicle with plate "%s".'):format(plate), 0)
    end

    if action == 'store' or action == 'retrieve' then
        local stored = action == 'store'
        if not fw.setStored(identifier, plate, stored) then
            error('The vehicle state did not change.', 0)
        end
        util.log('%s %s for %s', action, plate, identifier)
        return { applied = true }
    end

    if action == 'plate' then
        local newPlate = requirePlate(body.newPlate, 'New plate')
        if newPlate == plate then error('That is already the plate.', 0) end
        if fw.plateTaken(newPlate) then
            error(('Plate "%s" is already on another vehicle.'):format(newPlate), 0)
        end

        local ok, err = fw.setPlate(identifier, plate, newPlate)
        if not ok then error(err or 'The plate did not change.', 0) end

        util.log('plate %s -> %s for %s', plate, newPlate, identifier)
        return { applied = true, plate = newPlate }
    end

    if action == 'delete' then
        if not fw.deleteVehicle(identifier, plate) then
            error('The vehicle was not deleted.', 0)
        end
        util.log('deleted vehicle %s for %s', plate, identifier)
        return { applied = true }
    end

    error(('Unknown action "%s".'):format(action), 0)
end

--- GTA plates are 8 characters. Generated in the common "12ABC345" shape so an
--- admin-issued car does not look obviously different in-game.
function handlers.generatePlate(fw)
    local digits = '0123456789'
    local letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

    for _ = 1, 25 do
        local plate = {}
        for i = 1, 8 do
            local pool = (i >= 3 and i <= 5) and letters or digits
            local pick = math.random(#pool)
            plate[i] = string.sub(pool, pick, pick)
        end
        local candidate = table.concat(plate)
        if not fw.plateTaken(candidate) then return candidate end
    end
    return nil
end

CAdmin.handlers = handlers
