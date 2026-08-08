-- HTTP router — the panel's only way in.
-- Copyright (c) chyarogroup 2026
--
-- Endpoints live at http://<host>:30120/cadminpanel/<path>. That is the public
-- game port, so every request is gated on a constant-time secret comparison and
-- a per-IP rate limit before it reaches a handler. Firewall the path or put it
-- behind a reverse proxy as well; a shared secret is the last line, not the only
-- one.

local util = CAdmin.util
local handlers = CAdmin.handlers

-- Exact routes first, split by method. /garage/vehicle (POST) and
-- /garage/:identifier (GET) only look alike — the method separates them, and
-- exact matches are tried before the prefix table either way.
local exact = {
    GET = {
        ['/ping'] = handlers.ping,
        ['/players'] = handlers.players,
        ['/players/search'] = handlers.playersSearch,
        ['/jobs'] = handlers.jobs,
        ['/inventory/items'] = handlers.items
    },
    POST = {
        ['/money'] = handlers.money,
        ['/job'] = handlers.job,
        ['/group'] = handlers.group,
        ['/inventory/give'] = handlers.giveItem,
        ['/garage/vehicle'] = handlers.vehicle
    }
}

local prefixed = {
    GET = {
        { prefix = '/characters/', handler = handlers.characters },
        { prefix = '/player/', handler = handlers.player },
        { prefix = '/garage/', handler = handlers.garage }
    }
}

--- Returns the handler and, for path-parameter routes, the account license or
--- opaque character identifier.
local function resolve(method, path)
    local byMethod = exact[method]
    if byMethod and byMethod[path] then return byMethod[path], nil end

    for _, route in ipairs(prefixed[method] or {}) do
        if string.sub(path, 1, #route.prefix) == route.prefix then
            local rest = string.sub(path, #route.prefix + 1)
            -- The panel encodeURIComponent's identifiers, so colons in ESX
            -- multichar keys arrive encoded. A remaining slash means it is not
            -- a single segment and so not an identifier.
            if rest ~= '' and not string.find(rest, '/', 1, true) then
                return route.handler, util.urlDecode(rest)
            end
        end
    end

    return nil, nil
end

local function decodeBody(raw)
    if not raw or raw == '' then return {} end
    local ok, decoded = pcall(json.decode, raw)
    if not ok or type(decoded) ~= 'table' then return nil end
    return decoded
end

--- oxmysql's `.await` needs a coroutine and SetHttpHandler does not run in one,
--- so every handler gets its own thread. The response is sent from in here
--- rather than by the handler, which keeps the { ok, data | error } shape in one
--- place.
local function dispatch(handler, identifier, body, params, res)
    CreateThread(function()
        local ok, result = pcall(handler, CAdmin.bridge.get(), body, params, res, identifier)

        if ok then
            return util.ok(res, result)
        end

        -- Handlers raise with error(msg, 0), which has no source prefix and is
        -- meant for the admin to read. Anything carrying a "file.lua:12:" is a
        -- real fault: log it here and hand back something that does not leak the
        -- resource's internals to whoever is holding the secret.
        local message = type(result) == 'string' and result or nil
        if not message or string.find(message, '%.lua:%d+:') then
            util.log('Unhandled error: %s', tostring(result))
            message = 'The game server hit an unexpected error. Check the server console.'
        end

        util.fail(res, 400, message)
    end)
end

SetHttpHandler(function(req, res)
    local ip = util.clientIp(req)

    -- Rate limit before the secret check, not after: this limiter exists to
    -- blunt a brute-force run at the secret, and one that only counted correct
    -- guesses would count nothing.
    if util.rateLimited(ip) then
        return util.fail(res, 429, 'Too many requests.')
    end

    if not util.secretMatches(util.header(req, 'X-Cadmin-Secret'), GetConvar('cadmin_api_secret', '')) then
        util.log('Rejected a request from %s — bad or missing X-Cadmin-Secret.', ip)
        return util.fail(res, 401, 'Bad or missing X-Cadmin-Secret.')
    end

    local method = string.upper(req.method or 'GET')
    local path, params = util.parsePath(req.path)

    local handler, identifier = resolve(method, path)
    if not handler then
        return util.fail(res, 404, ('No endpoint at %s %s.'):format(method, path))
    end

    -- /ping answers before detection finishes on purpose: the wizard's Test
    -- connection has to tell "resource up, no framework found" apart from
    -- "server unreachable", and a 503 here would read as the latter.
    if path ~= '/ping' and not CAdmin.bridge.isReady() then
        return util.fail(res, 503,
            'The resource has not detected a framework yet. Check the server console for [cadminpanel].')
    end

    if method ~= 'POST' then
        -- setDataHandler is deliberately not called for a GET: with no body it
        -- may never fire, and the request would hang until the panel times out.
        return dispatch(handler, identifier, {}, params, res)
    end

    req.setDataHandler(function(raw)
        local body = decodeBody(raw)
        if not body then
            return util.fail(res, 400, 'The request body was not JSON.')
        end
        dispatch(handler, identifier, body, params, res)
    end)
end)

util.log('v%s — HTTP API on http://<host>:%d/%s/', CAdminConfig.version,
    GetConvarInt('netPort', 30120), GetCurrentResourceName())
