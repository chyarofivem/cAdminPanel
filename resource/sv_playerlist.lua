-- Prevent running in monitor mode
if not TX_SERVER_MODE then return end


-- =============================================
--  Server PlayerList handler
-- =============================================

local function logError(x)
    txPrint("^1" .. x)
end
local oneSyncConvar = GetConvar('onesync', 'off')
local onesyncEnabled = oneSyncConvar == 'on' or oneSyncConvar == 'legacy'


-- Optimizations
local floor = math.floor
local min = math.min
local sub = string.sub
local tonumber = tonumber
local tostring = tostring
local pairs = pairs


-- Variables & Consts
local connectionRefEpoch = ('%d:%d'):format(os.time(), GetGameTimer())
local connectionRefCounter = 0
local connectionRefStateKey = 'txAdminConnectionRef'
local reportedConnectionRefs = {}
-- https://www.desmos.com/calculator/dx9f5ko2ge
local refreshMinDelay = 1500
local refreshMaxDelay = 5000
local maxPlayersDelayCeil = 300 --at this number, the delay won't increase more
local intervalYieldLimit = 50
local vTypeMap = {
    ["nil"] = -1,
    ["walking"] = 0,
    ["automobile"] = 1,
    ["bike"] = 2,
    ["boat"] = 3,
    ["heli"] = 4,
    ["plane"] = 5,
    ["submarine"] = 6,
    ["trailer"] = 7,
    ["train"] = 8,
}


-- Returns an opaque reference that changes whenever a server ID gets a new connection.
local function createConnectionRef(serverID)
    connectionRefCounter = connectionRefCounter + 1
    return ('%s:%d:%s'):format(connectionRefEpoch, connectionRefCounter, tostring(serverID))
end

-- Player state survives a monitor resource restart and is discarded with the connection.
local function getConnectionRef(serverID)
    local playerState = Player(tonumber(serverID)).state
    local storedRef = playerState[connectionRefStateKey]
    if type(storedRef) == 'string' and storedRef ~= '' then
        return storedRef
    end

    local connectionRef = createConnectionRef(serverID)
    playerState:set(connectionRefStateKey, connectionRef, false)
    return connectionRef
end

function TX_GET_PLAYER_CONNECTION_REF(serverID)
    local playerData = TX_PLAYERLIST[tostring(serverID)]
    if type(playerData) ~= 'table' or type(GetPlayerName(tonumber(serverID))) ~= 'string' then
        return nil
    end
    return playerData.connectionRef
end

function TX_VALIDATE_PLAYER_CONNECTION(serverID, expectedConnectionRef, adminSource)
    if type(expectedConnectionRef) ~= 'string' or expectedConnectionRef == '' then
        if adminSource then
            TriggerClientEvent('txcl:playerActionResult', adminSource, false, 'nui_menu.player_modal.misc.disconnected')
        end
        return false
    end
    local matches = TX_GET_PLAYER_CONNECTION_REF(serverID) == expectedConnectionRef
    if not matches and adminSource then
        TriggerClientEvent('txcl:playerActionResult', adminSource, false, 'nui_menu.player_modal.misc.disconnected')
    end
    return matches
end


--[[ Wrapper to refresh player list data ]]
local function refreshPlayerList()
    -- For each player
    local players = GetPlayers()
    for yieldCounter, serverID in pairs(players) do
        -- Updating player vehicle/health
        local health = -1
        local vType = -1
        local xCoord = nil
        local yCoord = nil
        if onesyncEnabled == true then
            local ped = GetPlayerPed(serverID)
            if ped and DoesEntityExist(ped) then
                health = GetPedHealthPercent(ped)
                local veh = GetVehiclePedIsIn(ped)
                if veh ~= 0 and DoesEntityExist(veh) then
                   vType = vTypeMap[tostring(GetVehicleType(veh))]
                else
                   vType = vTypeMap["walking"]
                end
                local coords = GetEntityCoords(ped)
                xCoord = math.floor(coords.x)
                yCoord = math.floor(coords.y)
            end
        end

        -- Updating TX_PLAYERLIST
        if type(TX_PLAYERLIST[serverID]) ~= 'table' then
            TX_PLAYERLIST[serverID] = {
                name = sub(GetPlayerName(serverID) or "unknown", 1, 75),
                connectionRef = getConnectionRef(serverID),
                health = health,
                vType = vType,
                xCoord = xCoord,
                yCoord = yCoord,
            }
        else
            if type(TX_PLAYERLIST[serverID].connectionRef) ~= 'string' then
                TX_PLAYERLIST[serverID].connectionRef = getConnectionRef(serverID)
            end
            TX_PLAYERLIST[serverID].health = health
            TX_PLAYERLIST[serverID].vType = vType
            TX_PLAYERLIST[serverID].xCoord = xCoord
            TX_PLAYERLIST[serverID].yCoord = yCoord
        end

        -- Mark as refreshed
        TX_PLAYERLIST[serverID].foundLastCheck = true

        -- Yield to prevent hitches
        if yieldCounter % intervalYieldLimit == 0 then
            Wait(0)
        end
    end --end for players


    --Check if player disconnected
    local playersOnline = 0
    for playerID, playerData in pairs(TX_PLAYERLIST) do
        if playerData.foundLastCheck == true then
            playersOnline = playersOnline + 1
            playerData.foundLastCheck = false
        else
            TX_PLAYERLIST[playerID] = nil
        end
    end
    return playersOnline
end


-- Reports one live connection to the backend player mirror.
local function reportPlayerConnection(serverID, connectionRef, isResync)
    if reportedConnectionRefs[connectionRef] then return end

    local numericServerID = tonumber(serverID)
    local playerDetectedName = GetPlayerName(numericServerID)
    if type(playerDetectedName) ~= 'string' then return end

    local tracePayload = {
        type = 'txAdminPlayerlistEvent',
        event = 'playerJoining',
        id = numericServerID,
        player = {
            name = sub(playerDetectedName, 1, 128),
            ids = GetPlayerIdentifiers(numericServerID),
            hwids = GetPlayerTokens(numericServerID),
            connectionRef = connectionRef,
        },
    }
    if isResync then tracePayload.resync = true end

    PrintStructuredTrace(json.encode(tracePayload))
    reportedConnectionRefs[connectionRef] = true
    return tracePayload.player
end


--[[ Thread to refresh player list ]]
CreateThread(function()
    while true do
        -- Attempt to refresh player list
        local callSuccess, callOutput = pcall(refreshPlayerList)
        local playersOnline = 0
        if callSuccess then
            playersOnline = callOutput
        else
            logError("failed to update playerlist")
        end

        -- DEBUG
        -- debugPrint("====================================")
        -- print(json.encode(TX_PLAYERLIST, {indent = true}))
        -- debugPrint("====================================")

        -- Refresh interval with linear function
        local hDiff = refreshMaxDelay - refreshMinDelay
        local calcDelay = (hDiff / maxPlayersDelayCeil) * (playersOnline) + refreshMinDelay
        local delay = floor(min(calcDelay, refreshMaxDelay))
        Wait(delay)
    end --end while true
end)


--[[ Handle player Join or Leave ]]
AddEventHandler('playerJoining', function(srcString, _oldID)
    -- sanity checking source
    if source <= 0 then
        logError('playerJoining event with source ' .. json.encode(source))
        return
    end

    -- checking if the player was not already dropped
    local playerDetectedName = GetPlayerName(source)
    if type(playerDetectedName) ~= 'string' then
        logError('Received a playerJoining for a player that was already dropped. There is some resource dropping the player at the playerJoining event handler without first waiting for the next tick.')
        return
    end

    local sourceKey = tostring(source)
    local connectionRef = getConnectionRef(sourceKey)
    local previousData = TX_PLAYERLIST[sourceKey]
    TX_PLAYERLIST[sourceKey] = {
        name = sub(playerDetectedName, 1, 75),
        connectionRef = connectionRef,
        health = type(previousData) == 'table' and previousData.health or -1,
        vType = type(previousData) == 'table' and previousData.vType or -1,
        xCoord = type(previousData) == 'table' and previousData.xCoord or nil,
        yCoord = type(previousData) == 'table' and previousData.yCoord or nil,
        foundLastCheck = true,
    }

    local playerData = reportPlayerConnection(source, connectionRef, false)
    if not playerData then return end

    -- relaying this info to all admins
    for adminID, _ in pairs(TX_ADMINS) do
        TriggerClientEvent('txcl:plist:updatePlayer', adminID, source, {
            name = playerData.name,
            connectionRef = connectionRef,
        })
    end
end)


-- Restore the backend mirror for players who were already connected when monitor started.
CreateThread(function()
    Wait(1000)
    local callSuccess = pcall(refreshPlayerList)
    if not callSuccess then
        return logError('failed to resync playerlist')
    end

    for serverID, playerData in pairs(TX_PLAYERLIST) do
        if type(playerData) == 'table' and type(playerData.connectionRef) == 'string' then
            reportPlayerConnection(serverID, playerData.connectionRef, true)
        end
    end
end)

AddEventHandler('playerDropped', function(reason, resource, category)
    -- sanity checking source
    if source <= 0 then
        logError('playerDropped event with source ' .. json.encode(source))
        return
    end

    if resource == 'monitor' and TX_IS_SERVER_SHUTTING_DOWN then
        reason = 'server_shutting_down'
    end

    local sourceKey = tostring(source)
    local currentPlayerData = TX_PLAYERLIST[sourceKey]
    local connectionRef = type(currentPlayerData) == 'table' and currentPlayerData.connectionRef or nil
    if connectionRef then reportedConnectionRefs[connectionRef] = nil end

    PrintStructuredTrace(json.encode({
        type = 'txAdminPlayerlistEvent',
        event = 'playerDropped',
        id = source,
        connectionRef = connectionRef,
        reason = reason,
        resource = resource,
        category = category,
    }))

    -- relaying this info to all admins
    for adminID, _ in pairs(TX_ADMINS) do
        TriggerClientEvent('txcl:plist:updatePlayer', adminID, source, {
            dropped = true,
            connectionRef = connectionRef,
        })
    end
    TX_PLAYERLIST[sourceKey] = nil
end)


-- Handle getDetailedPlayerlist
-- This event is only called when the menu "players" tab is opened, and every 5s while the tab is open
-- DEBUG playerlist scroll test stuff
-- math.randomseed(os.time())
-- local fake_playerlist = {}
-- local fake_admins = {1, 10, 21, 61, 91, 141, 281}
-- local function getFakePlayer()
--     return {
--         name = 'fake'..tostring(math.random(999999)),
--         health = 0,
--         vType = math.random(8),
--     }
-- end
-- for serverID=1, 500 do
--     fake_playerlist[serverID] = getFakePlayer()
-- end
RegisterNetEvent('txsv:req:plist:getDetailed', function(getPlayerNames)
    if TX_ADMINS[tostring(source)] == nil then
        debugPrint('Ignoring unauthenticated getDetailedPlayerlist() by ' .. source)
        return
    end

    local players = {}
    --DEBUG replace TX_PLAYERLIST with fake_playerlist and playerData.health with math.random(150)
    for playerID, playerData in pairs(TX_PLAYERLIST) do
        players[#players + 1] = {
            tonumber(playerID),
            playerData.health,
            playerData.vType,
            playerData.xCoord,
            playerData.yCoord,
        }
        if getPlayerNames then
            players[#players][6] = playerData.name
        end
        players[#players][7] = playerData.connectionRef
    end
    local admins = {}
    for adminID, _ in pairs(TX_ADMINS) do
        admins[#admins + 1] = tonumber(adminID)
    end
    --DEBUG replace admins with fake_admins
    TriggerClientEvent('txcl:plist:setDetailed', source, players, admins)
end)


-- Sends the initial playlist to a specific admin
-- Triggered by the server after admin auth
function sendInitialPlayerlist(adminID)
    local payload = {}
    --DEBUG replace TX_PLAYERLIST with fake_playerlist
    for playerID, playerData in pairs(TX_PLAYERLIST) do
        payload[#payload + 1] = { tonumber(playerID), playerData.name, playerData.connectionRef }
    end
    --DEBUG
    -- debugPrint("====================================")
    -- print(json.encode(payload, {indent = true}))
    -- debugPrint("====================================")

    debugPrint('Sending initial playerlist to ' .. adminID)
    TriggerClientEvent('txcl:plist:setInitial', adminID, payload)
end
