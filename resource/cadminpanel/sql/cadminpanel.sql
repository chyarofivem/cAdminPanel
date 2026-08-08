-- cAdminPanel — schema for the chyarogroup FiveM Admin Panel bridge.
-- Copyright (c) chyarogroup 2026
--
-- Run this once against your framework's database. Nothing here touches an
-- existing ESX or Qbox table: the resource reads those, and only ever writes to
-- the two tables below.

-- Items given to an offline character. `identifier` is the framework character
-- key: citizenid on Qbox and users.identifier on ESX. It is intentionally not
-- the shared FiveM license, because one license can own several characters.
--
-- ox_inventory has no supported server export for writing an unloaded player's
-- inventory, and hand-editing its serialized blob means writing a format it owns
-- and may change — getting that wrong corrupts a whole inventory rather than
-- failing loudly. So an offline give is recorded here and handed over on the
-- player's next login. Rows are deleted only after ox_inventory accepts the
-- item, so a full inventory leaves it queued rather than swallowing it.
CREATE TABLE IF NOT EXISTS `cadmin_pending_items` (
    `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `identifier` VARCHAR(128) NOT NULL,
    `item`       VARCHAR(64)  NOT NULL,
    `count`      INT UNSIGNED NOT NULL DEFAULT 1,
    `metadata`   TEXT         NULL DEFAULT NULL,
    `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by` VARCHAR(64)  NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    -- Every read is "what is waiting for this player", on login and on the
    -- panel's player page.
    KEY `idx_cadmin_pending_identifier` (`identifier`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Admin groups, Qbox only.
--
-- ESX keeps the group in `users`.`group`, so it persists on its own. Qbox has no
-- such column — groups are ACE principals — and qbx_core has moved its own
-- permission persistence between releases. This table is the panel's durable
-- record: it is what an offline group change writes, what the panel reads back,
-- and what the resource re-applies as a principal when the player next loads.
--
-- Deliberately not qbx_core's `player_groups`, which holds jobs and gangs.
CREATE TABLE IF NOT EXISTS `cadmin_groups` (
    `citizenid`  VARCHAR(50) NOT NULL,
    `group`      VARCHAR(50) NOT NULL DEFAULT 'user',
    `updated_at` TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    -- One group per character, so a change updates rather than accumulates.
    PRIMARY KEY (`citizenid`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
