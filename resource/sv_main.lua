-- Prevent running in monitor mode
if not TX_SERVER_MODE then return end

--Helpers
local function logError(x)
    txPrint("^1" .. x)
end
-- function unDeQuote(x)
--     local new, count = string.gsub(x, utf8.char(0xFF02), '"')
--     return new
-- end
function replaceSemicolon(x)
    local new, count = string.gsub(x, utf8.char(0x037E), ';')
    return new
end

if GetCurrentResourceName() ~= "monitor" then
    logError('This resource should not be installed separately, it already comes with fxserver.')
    return
end


-- =============================================
-- MARK: Variables stuff
-- =============================================
TX_ADMINS = {}
TX_PLAYERLIST = {}
TX_LUACOMHOST = GetConvar("txAdmin-luaComHost", "invalid")
TX_LUACOMTOKEN = GetConvar("txAdmin-luaComToken", "invalid")
TX_VERSION = GetResourceMetadata('monitor', 'version') -- for now, only used in the start print
TX_IS_SERVER_SHUTTING_DOWN = false

-- Checking convars
if TX_LUACOMHOST == "invalid" or TX_LUACOMTOKEN == "invalid" then
    txPrint('^1API Host or Pipe Token ConVars not found. Do not start this resource manually - it is managed by the panel.')
    return
end
if TX_LUACOMTOKEN == "removed" then
    txPrint('^1Please do not restart the monitor resource.')
    return
end

-- Erasing the token convar for security reasons, and then restoring it if debug mode.
-- The convar needs to be reset on first tick to prevent other resources from reading it.
-- We actually need to wait two frames: one for convar replication, one for debugPrint.
SetConvar("txAdmin-luaComToken", "removed")
CreateThread(function()
    Wait(0)
    if not TX_DEBUG_MODE then return end
    debugPrint("Restoring txAdmin-luaComToken for next monitor restart")
    SetConvar("txAdmin-luaComToken", TX_LUACOMTOKEN)
end)


-- =============================================
-- MARK: Heartbeat functions
-- =============================================
local httpHbUrl = "http://" .. TX_LUACOMHOST .. "/intercom/monitor"
local httpHbPayload = json.encode({ txAdminToken = TX_LUACOMTOKEN })
local hbReturnData = '{"error": "no data cached in sv_main.lua"}'
local function HTTPHeartBeat()
    PerformHttpRequest(httpHbUrl, function(httpCode, data, resultHeaders)
        local resp = tostring(data)
        if httpCode ~= 200 then
            hbReturnData = "HeartBeat failed with code " .. httpCode .. " and message: " .. resp
            logError(hbReturnData)
        else
            hbReturnData = resp
        end
    end, 'POST', httpHbPayload, { ['Content-Type'] = 'application/json' })
end

local fd3HbPayload = json.encode({ type = 'txAdminHeartBeat' })
local function FD3HeartBeat()
    PrintStructuredTrace(fd3HbPayload)
end

-- HTTP request handler
local notFoundResponse = json.encode({ error = 'route not found' })
local function handleHttp(req, res)
    res.writeHead(200, { ["Content-Type"] = "application/json" })

    if req.path == '/stats.json' then
        return res.send(hbReturnData)
    else
        return res.send(notFoundResponse)
    end
end


-- =============================================
-- MARK: Commands
-- =============================================

--- Simple stdout reply just to make sure the resource is alive
--- this is only used in debug
local function txaPing(source, args)
    txPrint("Pong! (monitor resource is running)")
    CancelEvent()
end


--- Get all resources/statuses and report back to the panel
local function txaReportResources(source, args)
    --Prepare resources list
    local resources = {}
    local max = GetNumResources() - 1
    for i = 0, max do
        local resName = GetResourceByFindIndex(i)
        local currentRes = {
            name = resName,
            status = GetResourceState(resName),
            author = GetResourceMetadata(resName, 'author'),
            version = GetResourceMetadata(resName, 'version'),
            description = GetResourceMetadata(resName, 'description'),
            path = GetResourcePath(resName)
        }
        resources[#resources+1] = currentRes
    end

    --Send to the panel
    local url = "http://"..TX_LUACOMHOST.."/intercom/resources"
    local exData = {
        txAdminToken = TX_LUACOMTOKEN,
        resources = resources
    }
    txPrint('Sending resources list to the panel.')
    PrintStructuredTrace(json.encode({
        type = 'txAdminResourceReport',
        resources = resources,
    }))
    PerformHttpRequest(url, function(httpCode, data, resultHeaders)
        local resp = tostring(data)
        if httpCode ~= 200 then
            logError("ReportResources failed with code "..httpCode.." and message: "..resp)
        end
    end, 'POST', json.encode(exData), {['Content-Type']='application/json'})
end


--- Setter for the txAdmin-debugMode convar and TX_DEBUG_MODE global variable
local function txaSetDebugMode(source, args)
    -- prevent execution from admins or resources
    if source ~= 0 or GetInvokingResource() ~= nil then return end
    -- validating argument
    if args[1] == nil then return end

    -- changing mode
    if args[1] == '1' then
        TX_DEBUG_MODE = true
        txPrint("^1!! Debug Mode enabled via console !!")
    elseif args[1] == '0' then
        TX_DEBUG_MODE = false
        txPrint("^1!! Debug Mode disabled via console !!")
    else
        txPrint("^1!! txaSetDebugMode only accepts '1' or '0' as input. !!")
    end
    SetConvarReplicated('txAdmin-debugMode', tostring(TX_DEBUG_MODE))
    TriggerClientEvent('txcl:setDebugMode', -1, TX_DEBUG_MODE)
end


-- =============================================
-- MARK: Events handling
-- =============================================
--- The panel always sets this convar on the command line, so the fallback only
--- matters if the resource is loaded some other way. It still reaches player-facing
--- announcements, DMs and punishment cards, so it has to stay game-neutral.
local txServerName = GetConvar("txAdmin-serverName", "Server")
local cvHideAdminInPunishments = GetConvarBool('txAdmin-hideAdminInPunishments')
local cvHideAdminInMessages = GetConvarBool('txAdmin-hideAdminInMessages')
local cvHideAnnouncement = GetConvarBool('txAdmin-hideDefaultAnnouncement')
local cvHideDirectMessage = GetConvarBool('txAdmin-hideDefaultDirectMessage')
local cvHideWarning = GetConvarBool('txAdmin-hideDefaultWarning')
local cvHideScheduledRestartWarning = GetConvarBool('txAdmin-hideDefaultScheduledRestartWarning')
-- Adding all known events to the list so txaEvent can do whitelist checking
TX_EVENT_HANDLERS = {
    -- Handled by another file
    adminPreferencesUpdated = false, -- sv_admins.lua
    adminsUpdated = false, -- sv_admins.lua
    configChanged = false, -- sv_ctx.lua

    -- Known NO-OP
    actionRevoked = false,
    adminAuth = false,
    consoleCommand = false,
    healedPlayer = false,
    playerHealed = false,
    playerWhitelisted = false,
    skippedNextScheduledRestart = false,
    scheduledRestartSkipped = false,
    whitelistPlayer = false,
    whitelistPreApproval = false,
    whitelistRequest = false,
}

--- Handler for announcement events
--- Broadcast admin message to all players
TX_EVENT_HANDLERS.announcement = function(eventData)
    local authorName = cvHideAdminInMessages and txServerName or eventData.author or 'anonym'
    if not cvHideAnnouncement then
        TriggerClientEvent('txcl:showAnnouncement', -1, eventData.message, authorName)
    end
    TriggerEvent('txsv:logger:addChatMessage', 'tx', '(Broadcast) '..authorName, eventData.message)
end


--- Handler for scheduled restarts event
--- Broadcast through a dedicated notification that the server will restart in XX minutes
TX_EVENT_HANDLERS.scheduledRestart = function(eventData)
    if not cvHideScheduledRestartWarning then
        TriggerClientEvent('txcl:showScheduledRestart', -1, eventData.translatedMessage)
    end
    TriggerEvent('txsv:logger:addChatMessage', 'tx', '(Broadcast) '..txServerName, eventData.translatedMessage)
end


--- Handler for player DM event
--- Sends a direct message from an admin to a player
TX_EVENT_HANDLERS.playerDirectMessage = function(eventData)
    if
        type(eventData.target) ~= 'number'
        or type(eventData.message) ~= 'string'
    then
        return txPrintError('[playerDirectMessage] invalid eventData', eventData)
    end
    if
        type(eventData.targetConnectionRef) == 'string'
        and eventData.targetConnectionRef ~= ''
        and TX_GET_PLAYER_CONNECTION_REF(eventData.target) ~= eventData.targetConnectionRef
    then
        return txPrint('[playerDirectMessage] ignored stale player connection #'..eventData.target)
    end
    local authorName = cvHideAdminInMessages and txServerName or eventData.author or 'anonym'
    if not cvHideDirectMessage then
        TriggerClientEvent('txcl:showDirectMessage', eventData.target, eventData.message, authorName)
    end
    TriggerEvent('txsv:logger:addChatMessage', 'tx', '(DM) '..authorName, eventData.message)
end


--- Handler for player kicked event
TX_EVENT_HANDLERS.playerKicked = function(eventData)
    Wait(0) -- give other resources a chance to read player data

    -- sanity check
    if
        type(eventData.target) ~= 'number'
        or type(eventData.reason) ~= 'string'
        or type(eventData.dropMessage) ~= 'string'
    then
        return txPrintError('[playerKicked] invalid eventData', eventData)
    end

    -- kicking
    if eventData.target == -1 then
        txPrint("Kicking everyone: "..eventData.reason)
        for _, pid in pairs(GetPlayers()) do
            DropPlayer(pid, eventData.dropMessage)
        end
    else
        if
            type(eventData.targetConnectionRef) == 'string'
            and eventData.targetConnectionRef ~= ''
            and TX_GET_PLAYER_CONNECTION_REF(eventData.target) ~= eventData.targetConnectionRef
        then
            return txPrint('[playerKicked] ignored stale player connection #'..eventData.target)
        end
        txPrint("Kicking: #"..eventData.target..": "..eventData.reason)
        DropPlayer(eventData.target, eventData.dropMessage)
    end
end


--- Handler for player warned event
--- Warn specific player via server ID
local pendingWarnings = {}
TX_EVENT_HANDLERS.playerWarned = function(eventData, isWarningNew)
    if isWarningNew == nil then isWarningNew = true end
    if cvHideWarning then return end
    if eventData.targetNetId == nil then return end

    if not DoesPlayerExist(eventData.targetNetId) then
        txPrint(string.format(
            '[handleWarnEvent] ignoring warning for disconnected player (#%s) %s',
            eventData.targetNetId,
            eventData.targetName
        ))
        return
    end

    pendingWarnings[tostring(eventData.targetNetId)] = eventData.actionId
    local authorName = cvHideAdminInPunishments and txServerName or eventData.author or 'anonym'
    TriggerClientEvent(
        'txcl:showWarning',
        eventData.targetNetId,
        authorName,
        eventData.reason,
        eventData.actionId,
        isWarningNew
    )
    txPrint(string.format(
        'Warning player (#%s) %s for %s',
        eventData.targetNetId,
        eventData.targetName,
        eventData.reason
    ))
end

-- Event so the client can ack the warning
RegisterNetEvent('txsv:ackWarning', function(actionId)
    if type(actionId) ~= 'string' then return end
    local srcStr = tostring(source)
    if pendingWarnings[srcStr] == actionId then
        PrintStructuredTrace(json.encode({
            type = 'txAdminAckWarning',
            actionId = actionId,
        }))
        pendingWarnings[srcStr] = nil
    end
end)

-- Remove any pending warnings when a player leaves
AddEventHandler('playerDropped', function()
    local srcStr = tostring(source)
    local pendingActionId = pendingWarnings[srcStr]
    if pendingActionId ~= nil then
        pendingWarnings[srcStr] = nil
        txPrint(string.format(
            'Player #%s left without accepting the warning [%s]',
            srcStr,
            pendingActionId
        ))
    end
end)


--- Handler for the player banned event
--- Ban player(s) via netid or identifiers
TX_EVENT_HANDLERS.playerBanned = function(eventData)
    Wait(0) -- give other resources a chance to read player data
    local kickCount = 0
    local kickedPlayers = {}
    local targetIds = {}

    for _, identifier in pairs(eventData.targetIds or {}) do
        if type(identifier) == 'string' then
            targetIds[string.lower(identifier)] = true
        end
    end

    local function kickPlayer(playerID)
        local playerKey = tostring(playerID)
        if kickedPlayers[playerKey] then return end
        txPrint('[handleBanEvent] Kicking #'..playerKey..': '..eventData.reason)
        kickedPlayers[playerKey] = true
        kickCount = kickCount + 1
        DropPlayer(playerID, eventData.kickMessage)
    end

    local directTarget = tonumber(eventData.targetNetId)
    if directTarget and DoesPlayerExist(directTarget) then
        local expectedRef = eventData.targetConnectionRef
        if
            type(expectedRef) ~= 'string'
            or expectedRef == ''
            or TX_GET_PLAYER_CONNECTION_REF(directTarget) == expectedRef
        then
            kickPlayer(directTarget)
        end
    end

    for _, playerID in pairs(GetPlayers()) do
        local identifiers = GetPlayerIdentifiers(playerID)
        if identifiers ~= nil then
            for _, playerIdentifier in pairs(identifiers) do
                if type(playerIdentifier) == 'string' and targetIds[string.lower(playerIdentifier)] then
                    kickPlayer(playerID)
                    break
                end
            end
        end
    end

    if kickCount == 0 then
        txPrint("[handleBanEvent] No players found to kick")
    end
end


--- Handler for the imminent shutdown event
--- Kicks all players and lock joins in preparation for server shutdown
TX_EVENT_HANDLERS.serverShuttingDown = function(eventData)
    txPrint('Server shutting down. Kicking all players.')
    TX_IS_SERVER_SHUTTING_DOWN = true
    local players = GetPlayers()
    for _, serverID in pairs(players) do
        DropPlayer(serverID, eventData.message)
    end
end


--- Command that receives all incoming tx events and dispatches
--- it to the respective event handler
local function txaEvent(source, args)
    -- sanity check
    if type(args[1]) ~= 'string' or type(args[2]) ~= 'string' then
        return txPrintError('[txaEvent] invalid argument types', type(args[1]), type(args[2]))
    end

    -- prevent execution from admins or resources
    if source ~= 0 then
        return txPrintError('[txaEvent] unexpected source', source)
    end
    if GetInvokingResource() ~= nil then
        return txPrintError('[txaEvent] unexpected invoking resource', GetInvokingResource())
    end

    -- processing event
    local eventName = args[1]
    local eventHandler = TX_EVENT_HANDLERS[eventName]
    if eventHandler == nil then
        return txPrintError("[txaEvent] No event handler exists for \"" .. eventName .. "\" event")
    end
    local eventData = json.decode(replaceSemicolon(args[2]))
    if type(eventData) ~= 'table' then
        return txPrintError('[txaEvent] invalid eventData', type(eventData))
    end

    -- print('~~~~~~~~~~~~~~~~~~~~~ txaEvent')
    -- print('Name:', eventName)
    -- print('Source:', json.encode(source))
    -- print('Resource:', json.encode(GetInvokingResource()))
    -- print('Data:', json.encode(eventData))
    -- print('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')

    -- need to trigger the event first, call handler after
    TriggerEvent('txAdmin:events:' .. eventName, eventData)
    if eventHandler ~= false then
        eventHandler(eventData)
    end
end


-- =============================================
-- MARK: Player connecting handler
-- =============================================

--- Escapes the characters that could break out of a html text node
local function escapeHtml(str)
    local escaped = tostring(str):gsub('&', '&amp;'):gsub('<', '&lt;'):gsub('>', '&gt;')
    return escaped
end

--- Converts a '#rrggbb' string into the comma-separated components of rgb()/rgba()
local function hexToRgbParts(hex)
    local r, g, b = tostring(hex):match('^#?(%x%x)(%x%x)(%x%x)$')
    if not r then return '37, 99, 235' end
    return string.format('%d, %d, %d', tonumber(r, 16), tonumber(g, 16), tonumber(b, 16))
end

--- Wraps a string in the same inline-styled <code> tag used by the panel
local function htmlCode(str)
    return '<code style="background-color: rgba(148, 163, 184, 0.22); padding: 2px 5px; border-radius: 5px;">'
        .. escapeHtml(str) .. '</code>'
end

--- Builds the on-brand card shown in the game's connection screen.
--- Mirrors rejectMessageTemplate() in core/routes/player/checkJoin.ts, so the messages
--- coming from this resource look the same as the ones coming from the panel.
--- NOTE: the title is escaped, but the content is not - it is trusted html built here.
local function buildConnectionCard(title, content)
    local ctx = GlobalState.txAdminServerCtx
    local panelName = txServerName .. ' Panel'
    local accent = '37, 99, 235'
    if type(ctx) == 'table' then
        if type(ctx.panelName) == 'string' and ctx.panelName ~= '' then
            panelName = ctx.panelName
        end
        if type(ctx.accentColor) == 'string' then
            accent = hexToRgbParts(ctx.accentColor)
        end
    end

    local cardStyle = ('margin-top: 25px; overflow: hidden; border: solid 1px rgba(%s, 0.35); border-radius: 12px; background-color: rgba(17, 20, 26, 0.72); box-shadow: 0 18px 42px rgba(0, 0, 0, 0.35);'):format(accent)
    local headerStyle = ('padding: 9px 22px; border-bottom: solid 1px rgba(%s, 0.28); background-color: rgba(%s, 0.16); color: rgb(%s); font-size: 0.85rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;'):format(accent, accent, accent)
    return ('<div style="%s"><div style="%s">%s</div><div style="padding: 18px 22px 22px;"><h2 style="margin: 0px; padding: 0px; font-size: 1.45rem; line-height: 1.3;">%s</h2><p style="margin: 12px 0px 0px; padding: 0px; font-size: 1.15rem; line-height: 1.55; opacity: 0.92;">%s</p></div></div>'):format(
        cardStyle,
        headerStyle,
        escapeHtml(panelName),
        escapeHtml(title),
        content
    )
end

local function handleConnections(name, setKickReason, d)
    -- if server is shutting down
    if TX_IS_SERVER_SHUTTING_DOWN then
        CancelEvent()
        setKickReason(buildConnectionCard(
            'Server is shutting down',
            'The server is currently shutting down. Please try connecting again in a few seconds.'
        ))
        return
    end

    local player = source
    if GetConvarBool("txAdmin-checkPlayerJoin") then
        d.defer()
        Wait(0)

        --Preparing vars and making sure we do have indentifiers
        local url = "http://"..TX_LUACOMHOST.."/player/checkJoin"
        local exData = {
            txAdminToken = TX_LUACOMTOKEN,
            playerIds = GetPlayerIdentifiers(player),
            playerHwids = GetPlayerTokens(player),
            playerName = name
        }
        if #exData.playerIds <= 1 then
            d.done(buildConnectionCard(
                'Missing player identifiers',
                'This server has bans or allowlisting enabled, which requires every player to have at least one identifier, but none were found on your account.<br>'
                    .. 'If you own this server, make sure ' .. htmlCode('sv_lan') .. ' is disabled in your server.cfg.'
            ))
            return
        end

        --Attempt to validate the user
        d.update("\nChecking banlist/allowlist... (0/5)")
        CreateThread(function()
            local attempts = 0
            local isDone = false;
            --Do 5 attempts (2.5 mins)
            while isDone == false and attempts < 5 do
                attempts = attempts + 1
                d.update("\nChecking banlist/allowlist... ("..attempts.."/5)")
                PerformHttpRequest(url, function(httpCode, rawData, resultHeaders)
                    if isDone then return end
                    -- rawData = nil
                    -- httpCode = 408

                    if not rawData or httpCode ~= 200 then
                        logError("Checking banlist/allowlist failed with code "..httpCode.." and message: "..tostring(rawData))
                    else
                        local respStr = tostring(rawData)
                        local respObj = json.decode(respStr)
                        if not respObj or type(respObj.allow) ~= "boolean" then
                            logError("Checking banlist/allowlist failed with invalid response: "..respStr)
                        else
                            if respObj.allow == true then
                                d.done()
                                isDone = true
                            else
                                local reason = respObj.reason
                                if type(reason) ~= 'string' or reason == '' then
                                    reason = buildConnectionCard(
                                        'Connection refused',
                                        'This server refused your connection, but no reason was provided.'
                                    )
                                end
                                d.done("\n"..reason)
                                isDone = true
                            end
                        end
                    end
                end, 'POST', json.encode(exData), {['Content-Type']='application/json'})
                Wait(30000) --30s
            end

            --Block client if failed
            if not isDone then
                d.done(buildConnectionCard(
                    'Could not verify your access',
                    'The server could not confirm your ban/allowlist status in time. Please try again in a few minutes.'
                ))
                isDone = true
            end
        end)

    end
end


-- =============================================
-- MARK: Setup threads and commands & main stuff
-- =============================================

-- All commands & handlers
RegisterCommand("txaPing", txaPing, true)
RegisterCommand("txaEvent", txaEvent, true)
RegisterCommand("txaReportResources", txaReportResources, true)
RegisterCommand("txaSetDebugMode", txaSetDebugMode, true)
AddEventHandler('playerConnecting', handleConnections)
SetHttpHandler(handleHttp)

CreateThread(function()
    Wait(1500)
    txaReportResources(0, {})
end)

-- HeartBeat functions are separated in case one hangs
CreateThread(function()
    while true do
        HTTPHeartBeat()
        Wait(3000)
    end
end)
CreateThread(function()
    while true do
        FD3HeartBeat()
        Wait(3000)
    end
end)

txPrint("Resource v"..TX_VERSION.." threads and commands set up. All Ready.")
