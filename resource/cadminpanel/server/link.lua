-- /link <code> — binds a character to a chyarologin account.
-- Copyright (c) chyarogroup 2026
--
-- The whole point of this flow is that the SERVER asserts who the player is.
-- The player supplies only a short code they generated on chyarologin; the
-- license comes from GetPlayerIdentifierByType, which no client can influence.
-- That is what the old browser-side link endpoint got wrong.
--
-- The request goes to the PANEL, not to chyarologin, so the chyarologin master
-- key never exists on the game server.

local util = CAdmin.util

-- Codes are 8 characters, uppercase, with 0/O/1/I left out so nobody types the
-- wrong one off a screen. Matching that here rather than sending anything the
-- player typed keeps obvious typos out of the panel's logs.
local CODE_PATTERN = '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$'
local CODE_LENGTH = 8

local function tell(source, message, colour)
    TriggerClientEvent('chat:addMessage', source, {
        color = colour or { 255, 140, 0 },
        multiline = true,
        args = { 'cAdminPanel', message }
    })
end

local function panelUrl()
    local url = CAdminConfig.panelUrl
    if not url or url == '' then return nil end
    return (string.gsub(url, '/+$', ''))
end

RegisterCommand(CAdminConfig.linkCommand, function(source, args)
    -- 0 is the server console, which has no license to link.
    if source == 0 then
        util.log('/%s has to be run by a player.', CAdminConfig.linkCommand)
        return
    end

    local base = panelUrl()
    if not base then
        tell(source, 'Account linking is not set up on this server. Tell an admin to set cadmin_panel_url.', { 255, 80, 80 })
        return
    end

    local secret = GetConvar('cadmin_api_secret', '')
    if secret == '' then
        tell(source, 'Account linking is not set up on this server. Tell an admin to set cadmin_api_secret.', { 255, 80, 80 })
        return
    end

    local code = args[1] and string.upper(args[1]) or nil
    if not code then
        tell(source, ('Usage: /%s <code> — generate your code on chyarologin first.'):format(CAdminConfig.linkCommand))
        return
    end
    if #code ~= CODE_LENGTH or not string.match(code, CODE_PATTERN) then
        tell(source, 'That does not look like a link code. They are 8 characters, letters and digits.', { 255, 80, 80 })
        return
    end

    local license = GetPlayerIdentifierByType(source, 'license')
    if not license then
        tell(source, 'Your license could not be read. Try rejoining.', { 255, 80, 80 })
        return
    end

    local name = GetPlayerName(source) or 'Unknown'
    tell(source, 'Checking that code…')

    PerformHttpRequest(base .. '/api/link/fivem', function(status, body)
        local payload
        if body and body ~= '' then
            local ok, decoded = pcall(json.decode, body)
            if ok then payload = decoded end
        end

        if status == 200 and payload and payload.ok then
            local email = payload.data and payload.data.email
            tell(source, ('Linked this character to %s.'):format(email or 'your chyarologin account'),
                { 80, 220, 120 })
            util.log('%s (%s) linked to %s', name, license, email or 'unknown account')
            return
        end

        -- The panel passes chyarologin's own message through, so the player sees
        -- "that code has expired" rather than a status number.
        local message = payload and payload.error or nil
        if not message then
            if status == 0 then
                message = 'The panel could not be reached. Try again in a minute.'
            elseif status == 401 then
                message = 'This server is not authorised by the panel. Tell an admin the shared secret is wrong.'
            else
                message = ('Linking failed (HTTP %s).'):format(tostring(status))
            end
        end

        tell(source, message, { 255, 80, 80 })
        util.log('link failed for %s (%s): %s', name, license, message)
    end, 'POST', json.encode({ code = code, license = license, name = name }), {
        ['Content-Type'] = 'application/json',
        ['X-Cadmin-Secret'] = secret
    })
end, false)

util.log('/%s registered.', CAdminConfig.linkCommand)
