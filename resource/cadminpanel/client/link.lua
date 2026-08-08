-- Client side of /link.
-- Copyright (c) chyarogroup 2026
--
-- The command itself is server-side, and that is the whole point: the license
-- is read with GetPlayerIdentifierByType on the server, not sent from here.
-- This file only registers the chat autocomplete hint.

CreateThread(function()
    -- chat can finish starting after this resource does, and a suggestion sent
    -- before it is listening is dropped without a warning.
    Wait(2000)

    TriggerEvent('chat:addSuggestion', '/' .. CAdminConfig.linkCommand,
        'Link this character to your chyarologin account.', {
            { name = 'code', help = 'The 8-character code from your chyarologin profile.' }
        })
end)

