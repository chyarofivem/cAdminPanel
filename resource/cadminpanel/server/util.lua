-- Shared helpers: auth, rate limiting, response shaping.
-- Copyright (c) chyarogroup 2026

CAdmin = CAdmin or {}
CAdmin.frameworks = CAdmin.frameworks or {}

local util = {}

--- Compares two strings without leaking, through timing, how much of the
--- secret matched. Length is checked first: that difference is observable
--- either way, and pretending otherwise would just mean walking a buffer of
--- the wrong size. The panel's own comparison works the same way.
function util.secretMatches(given, expected)
    if type(given) ~= 'string' or type(expected) ~= 'string' then return false end
    if #expected == 0 or #given ~= #expected then return false end

    local diff = 0
    for i = 1, #expected do
        diff = diff | (string.byte(given, i) ~ string.byte(expected, i))
    end
    return diff == 0
end

--- FiveM hands headers back with whatever casing the client sent, so every
--- lookup goes through here rather than indexing the table directly.
function util.header(req, name)
    local wanted = string.lower(name)
    for key, value in pairs(req.headers or {}) do
        if string.lower(key) == wanted then
            -- Some proxies fold repeated headers into a table.
            if type(value) == 'table' then return value[1] end
            return value
        end
    end
    return nil
end

--- `req.address` is "ip:port"; the port changes per connection and would defeat
--- the rate limiter, so it is dropped.
function util.clientIp(req)
    local address = req.address or 'unknown'
    return (string.gsub(address, ':%d+$', ''))
end

local buckets = {}

--- Fixed-window counter, per IP. Deliberately simple: this exists to blunt a
--- brute-force run at the secret, not to shape traffic.
function util.rateLimited(ip)
    local now = GetGameTimer()
    local bucket = buckets[ip]

    if not bucket or now >= bucket.resetAt then
        buckets[ip] = { count = 1, resetAt = now + CAdminConfig.rateLimit.windowMs }
        return false
    end

    bucket.count = bucket.count + 1
    return bucket.count > CAdminConfig.rateLimit.max
end

--- Windows expire on their own, but an abandoned IP would otherwise keep its
--- table entry forever. Swept rather than checked per request.
CreateThread(function()
    while true do
        Wait(300000)
        local now = GetGameTimer()
        for ip, bucket in pairs(buckets) do
            if now >= bucket.resetAt then buckets[ip] = nil end
        end
    end
end)

--- Splits "/player/license:abc?foo=1" into its path and a query table.
function util.parsePath(raw)
    local path, query = string.match(raw or '/', '^([^?]*)%??(.*)$')
    local params = {}

    for pair in string.gmatch(query or '', '[^&]+') do
        local key, value = string.match(pair, '^([^=]*)=?(.*)$')
        if key and key ~= '' then
            params[util.urlDecode(key)] = util.urlDecode(value)
        end
    end

    -- Trailing slashes are stripped so /players and /players/ are one route.
    if path ~= '/' then path = (string.gsub(path, '/+$', '')) end
    if path == '' then path = '/' end

    return path, params
end

function util.urlDecode(str)
    if not str then return '' end
    str = string.gsub(str, '+', ' ')
    return (string.gsub(str, '%%(%x%x)', function(hex)
        return string.char(tonumber(hex, 16))
    end))
end

--- Every response the panel sees is { ok = true, data = ... } or
--- { ok = false, error = "..." }. lib/gameapi.js unwraps exactly that.
function util.respond(res, status, body)
    res.writeHead(status, {
        ['Content-Type'] = 'application/json; charset=utf-8',
        -- This API is machine-to-machine. Saying so stops a browser from being
        -- talked into making requests on an admin's behalf.
        ['Access-Control-Allow-Origin'] = 'null',
        ['X-Content-Type-Options'] = 'nosniff',
        ['Cache-Control'] = 'no-store'
    })
    res.send(json.encode(body))
end

function util.ok(res, data)
    -- `data` may legitimately be nil (an action that returns nothing). false is
    -- used rather than nil so the key survives JSON encoding as a value.
    util.respond(res, 200, { ok = true, data = data == nil and false or data })
end

function util.fail(res, status, message)
    util.respond(res, status, { ok = false, error = message })
end

function util.log(fmt, ...)
    print(('[cadminpanel] ' .. fmt):format(...))
end

--- Trims and caps a string coming off the wire. Every value the panel sends is
--- run through this before it reaches SQL or a framework export.
function util.str(value, maxLength)
    if type(value) == 'number' then value = tostring(value) end
    if type(value) ~= 'string' then return nil end
    value = string.match(value, '^%s*(.-)%s*$')
    if value == '' then return nil end
    if maxLength and #value > maxLength then return nil end
    return value
end

--- Money and counts must be whole numbers. Strings are accepted because form
--- posts arrive as strings, but "12abc" and 1.5 are not numbers here.
function util.int(value, min, max)
    local number = tonumber(value)
    if not number or number ~= math.floor(number) then return nil end
    if min and number < min then return nil end
    if max and number > max then return nil end
    return math.tointeger(number) or number
end

--- FiveM identifiers, as GetPlayerIdentifierByType reports them. Anything that
--- is not this shape never reaches a WHERE clause.
function util.isLicense(identifier)
    if type(identifier) ~= 'string' then return false end
    if #identifier ~= 48 and #identifier ~= 49 then return false end
    return string.match(identifier, '^license2?:%x+$') ~= nil
end

--- Framework character keys are opaque values. Qbox uses `citizenid`; ESX
--- uses its `users.identifier` value (which may be a multichar key rather than
--- a bare FiveM license). They are always sent as a single URL segment or a
--- JSON field, so controls and URL separators are the only unsafe values.
function util.isCharacterId(identifier)
    return type(identifier) == 'string'
        and #identifier > 0
        and #identifier <= 128
        and not string.find(identifier, '[%z\1-\31\127/?#]')
end

--- The property blob a granted vehicle is stored with.
---
--- This is not cosmetic padding. Garage scripts treat the stored blob as a full
--- ox_lib property table and read it without nil guards — qbx_garages divides
--- `props.engineHealth` by 10 to draw its condition bar, so a blob missing that
--- key is a client-side script error the moment the vehicle is inspected, and
--- the player cannot take out the car we just gave them. `model` matters just as
--- much: qbx_garages spawns from `props.model`, not from the `vehicle` column.
---
--- So a granted vehicle is written as a *complete, pristine* vehicle: full
--- health, full fuel, no modifications. Anything the garage divides, compares or
--- spawns from is present and numeric.
function util.vehicleProps(model, plate)
    return {
        model = GetHashKey(model),
        plate = plate,
        -- Read directly by garage UIs. 1000 is the engine/body maximum.
        engineHealth = 1000.0,
        bodyHealth = 1000.0,
        tankHealth = 1000.0,
        fuelLevel = 100.0,
        oilLevel = 100.0,
        dirtLevel = 0.0,
        -- ox_lib restores these on spawn; an empty/neutral value each.
        plateIndex = 0,
        color1 = 0,
        color2 = 0,
        pearlescentColor = 0,
        wheelColor = 0,
        interiorColor = 0,
        dashboardColor = 0,
        wheels = 0,
        windowTint = -1,
        -- Doors, windows and tyres all intact: an empty list means "none broken".
        doors = {},
        windows = {},
        tyres = {},
        extras = {},
        neonEnabled = { false, false, false, false },
        neonColor = { 255, 255, 255 },
        -- 1 = unlocked. qbx_garages overwrites this on retrieval anyway, but a
        -- vehicle should not arrive in the garage in an undefined lock state.
        lockState = 1
    }
end

CAdmin.util = util
