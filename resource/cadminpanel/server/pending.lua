-- Queued item delivery for offline players.
-- Copyright (c) chyarogroup 2026
--
-- ox_inventory has no supported server export for writing an unloaded player's
-- inventory. The alternative — hand-editing its serialized blob — means writing
-- a format ox_inventory owns and may change, and getting it wrong corrupts a
-- player's whole inventory rather than failing loudly.
--
-- So an offline give is recorded here and handed over the moment the player
-- next loads in. The panel says so in the UI: "Queued — delivered on next login".

local util = CAdmin.util
local T = CAdminConfig.tables

local pending = {}

--- Every entry point checks this first. The table is created at boot by
--- schema.ensure(); when that could not run, a queued give must fail loudly
--- rather than report success and drop the item, while a *count* of what is
--- waiting is honestly zero.
local function tableReady()
    return CAdmin.schema and CAdmin.schema.ready
end

function pending.queue(identifier, item, count, metadata, createdBy)
    if not tableReady() then
        error(('The `%s` table is missing and could not be created. Import sql/cadminpanel.sql.')
            :format(T.pendingItems), 0)
    end

    MySQL.insert.await(
        ([[INSERT INTO `%s` (identifier, item, count, metadata, created_by)
           VALUES (?, ?, ?, ?, ?)]]):format(T.pendingItems),
        { identifier, item, count, metadata and json.encode(metadata) or nil, createdBy }
    )
    util.log('Queued %dx %s for %s (offline).', count, item, identifier)
end

function pending.countFor(identifier)
    if not tableReady() then return 0 end
    local row = MySQL.single.await(
        ('SELECT COUNT(*) AS total FROM `%s` WHERE identifier = ?'):format(T.pendingItems),
        { identifier }
    )
    return row and tonumber(row.total) or 0
end

--- Releases before 1.0 keyed Qbox queues by the account license. That value is
--- safe to migrate only when the account owns exactly one character. Ambiguous
--- rows are deliberately left untouched and logged for a manual citizenid
--- choice; silently assigning them would deliver inventory to the wrong slot.
function pending.migrateLegacyIdentifiers(framework)
    if not tableReady() or not framework or framework.id ~= 'qbox' then return end

    local rows = MySQL.query.await(
        ('SELECT DISTINCT `identifier` FROM `%s` WHERE identifier LIKE ? OR identifier LIKE ?')
            :format(T.pendingItems),
        { 'license:%', 'license2:%' }
    ) or {}

    for _, row in ipairs(rows) do
        if util.isLicense(row.identifier) then
            local characters = framework.getPlayersByLicense(row.identifier)
            if #characters == 1 then
                local characterId = characters[1].characterId or characters[1].identifier
                MySQL.update.await(
                    ('UPDATE `%s` SET `identifier` = ? WHERE `identifier` = ?'):format(T.pendingItems),
                    { characterId, row.identifier }
                )
                util.log('Migrated legacy pending items from %s to character %s.', row.identifier, characterId)
            elseif #characters > 1 then
                util.log('WARNING: pending items for %s were not migrated because it owns %d characters. '
                    .. 'Update those rows to the intended citizenid before delivery.', row.identifier, #characters)
            end
        end
    end
end

--- Rows are deleted only after ox_inventory has accepted the item, so a full
--- inventory or a restart mid-delivery leaves the item queued rather than
--- silently swallowing it.
function pending.deliver(source, identifier)
    if not identifier then return end
    if not tableReady() then return end
    if GetResourceState('ox_inventory') ~= 'started' then return end

    local rows = MySQL.query.await(
        ('SELECT `id`, `item`, `count`, `metadata` FROM `%s` WHERE identifier = ? ORDER BY id'):format(T.pendingItems),
        { identifier }
    ) or {}
    if #rows == 0 then return end

    local delivered, failed = 0, 0

    for _, row in ipairs(rows) do
        local metadata
        if row.metadata and row.metadata ~= '' then
            local decoded = json.decode(row.metadata)
            if type(decoded) == 'table' then metadata = decoded end
        end

        local ok, added = pcall(function()
            return exports.ox_inventory:AddItem(source, row.item, row.count, metadata)
        end)

        if ok and added then
            MySQL.update.await(('DELETE FROM `%s` WHERE id = ?'):format(T.pendingItems), { row.id })
            delivered = delivered + 1
        else
            failed = failed + 1
        end
    end

    if delivered > 0 then
        TriggerClientEvent('chat:addMessage', source, {
            color = { 255, 140, 0 },
            multiline = true,
            args = { CAdminConfig.displayName, ('%d item(s) waiting for you have been delivered.'):format(delivered) }
        })
    end

    if failed > 0 then
        util.log('%d queued item(s) for %s could not be delivered (inventory full?). They stay queued.',
            failed, identifier)
        TriggerClientEvent('chat:addMessage', source, {
            color = { 255, 80, 80 },
            multiline = true,
            args = { CAdminConfig.displayName, ('%d item(s) could not fit. Free some space and rejoin.'):format(failed) }
        })
    end
end

local function deliverFor(source)
    -- A short delay: ox_inventory sets the player's inventory up on the same
    -- event, and adding to it before it exists silently does nothing.
    SetTimeout(3000, function()
        local framework = CAdmin.bridge and CAdmin.bridge.get()
        if not framework or not framework.characterIdForSource then return end
        local characterId = framework.characterIdForSource(source)
        if characterId then pending.deliver(source, characterId) end
    end)
end

-- Both frameworks, since the resource does not know which one is live until
-- detection finishes and these handlers register at load.
AddEventHandler('esx:playerLoaded', function(source)
    deliverFor(source)
end)

RegisterNetEvent('QBCore:Server:PlayerLoaded', function(player)
    local playerSource = type(player) == 'table' and player.PlayerData and player.PlayerData.source
        or tonumber(player) or source
    if playerSource then deliverFor(playerSource) end
end)

AddEventHandler('qbx_core:server:playerLoaded', function(player)
    local playerSource = type(player) == 'table' and player.PlayerData and player.PlayerData.source
        or tonumber(player) or source
    if playerSource then deliverFor(playerSource) end
end)

CAdmin.pending = pending
