-- Prevent running in monitor mode
if not TX_SERVER_MODE then return end
-- Prevent running if menu is disabled
if not TX_MENU_ENABLED then return end

local frozenPlayers = {}

local function isPlayerFrozen(targetId, connectionRef)
  local frozenPlayer = frozenPlayers[targetId]
  return frozenPlayer ~= nil
    and frozenPlayer.connectionRef == connectionRef
    and frozenPlayer.status == true
end

local function setPlayerFrozenInMap(targetId, connectionRef, status)
  frozenPlayers[targetId] = status and {
    connectionRef = connectionRef,
    status = true,
  } or nil
end

RegisterNetEvent('txsv:req:freezePlayer', function(targetId, connectionRef)
  local src = source
  if type(targetId) ~= 'number' then
    return
  end
  local allow = PlayerHasTxPermission(src, 'players.freeze')
    and TX_VALIDATE_PLAYER_CONNECTION(targetId, connectionRef, src)
  TriggerEvent('txsv:logger:menuEvent', src, 'freezePlayer', allow, targetId)
  if allow then
    local newFrozenStatus = not isPlayerFrozen(targetId, connectionRef)
    setPlayerFrozenInMap(targetId, connectionRef, newFrozenStatus)

    TriggerClientEvent('txcl:freezePlayerOk', src, newFrozenStatus)
    TriggerClientEvent('txcl:setFrozen', targetId, newFrozenStatus)
  end
end)
