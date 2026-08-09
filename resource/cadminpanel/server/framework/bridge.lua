-- Framework detection and dispatch.
-- Copyright (c) chyarogroup 2026
--
-- Everything above this line talks to one interface. Which adapter is behind it
-- is decided once, at start, and never again — a server does not change
-- framework while it is running.

local util = CAdmin.util

local bridge = {
    active = nil,
    name = nil,
    ready = false,
    -- What the boot-time schema check found. Surfaced through /ping so the
    -- wizard can show it, rather than waiting for a request to fail.
    --
    -- `checked` separates "the check has not run yet" from "the check failed":
    -- /ping answers before detection finishes, and reporting a failure the
    -- resource has not yet attempted would send someone looking for a database
    -- problem that does not exist.
    schema = { checked = false, ok = false, missing = {} }
}

local function pick()
    local forced = string.lower(CAdminConfig.framework or 'auto')

    if forced ~= 'auto' then
        local adapter = CAdmin.frameworks[forced]
        if not adapter then
            util.log('cadmin_framework is set to "%s", which is not a framework this resource knows.', forced)
            return nil
        end
        if not adapter.detect() then
            util.log('cadmin_framework is set to "%s" but that resource is not started.', forced)
            return nil
        end
        return adapter
    end

    -- Deterministic order. A server running both is misconfigured, but it should
    -- pick the same one every start rather than whichever hashed first.
    for _, id in ipairs({ 'esx', 'qbox' }) do
        local adapter = CAdmin.frameworks[id]
        if adapter and adapter.detect() then return adapter end
    end
    return nil
end

CreateThread(function()
    -- Frameworks export their shared object during their own start, so waiting a
    -- tick avoids a race where es_extended is "started" but not yet exporting.
    Wait(1000)

    local adapter = pick()
    if not adapter then
        util.log('No supported framework detected. Start es_extended or qbx_core, or set cadmin_framework.')
        return
    end

    if not adapter.init() then
        util.log('Detected %s but could not get hold of it. Is it fully started?', adapter.id)
        return
    end

    bridge.active = adapter
    bridge.name = adapter.id
    bridge.ready = true

    -- Before the first request, not during one: our two tables are created if
    -- absent, and the framework's are checked by name so a renamed table is
    -- named in the console instead of surfacing as a failed search.
    bridge.schema.ok = CAdmin.schema.ensure()
    bridge.schema.missing = CAdmin.schema.checkFramework(adapter.id)
    bridge.schema.checked = true

    if bridge.schema.ok and #bridge.schema.missing == 0
        and CAdmin.pending and CAdmin.pending.migrateLegacyIdentifiers then
        local migrated, migrationError = pcall(CAdmin.pending.migrateLegacyIdentifiers, adapter)
        if not migrated then util.log('Could not migrate legacy pending item keys: %s', tostring(migrationError)) end
    end

    -- Adapters can reconcile players who were already online when only this
    -- resource restarted. This must happen after schema initialization because
    -- Qbox group persistence is database-backed.
    if adapter.onReady then
        local reconciled, reconcileError = pcall(adapter.onReady)
        if not reconciled then
            util.log('Could not reconcile existing %s players: %s', adapter.id, tostring(reconcileError))
        end
    end

    util.log('Ready — %s detected%s.', adapter.id,
        GetResourceState('ox_inventory') == 'started' and ', ox_inventory found' or ', ox_inventory NOT found')

    if GetConvar('cadmin_api_secret', '') == '' then
        util.log('WARNING: cadmin_api_secret is not set. Every panel request will be rejected.')
    end
end)

--- Nil until detection finishes. Callers check `ready` rather than assuming,
--- so a request arriving in the first second gets a clear 503 instead of a
--- Lua error in the console.
function bridge.get()
    return bridge.active
end

function bridge.isReady()
    return bridge.ready
end

function bridge.frameworkName()
    return bridge.name
end

function bridge.schemaState()
    return bridge.schema
end

CAdmin.bridge = bridge
