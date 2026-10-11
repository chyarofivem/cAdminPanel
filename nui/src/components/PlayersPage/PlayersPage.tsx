import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslate } from "react-polyglot";
import {
  PlayerDataFilter,
  PlayerDataSort,
  useFilteredSortedPlayers,
  usePlayersFilterBy,
  usePlayersSearch,
  usePlayersSortBy,
  usePlayersState,
  useSetPlayersFilterIsTemp,
} from "../../state/players.state";
import { usePlayerListListener, VehicleStatus } from "../../hooks/usePlayerListListener";
import { useServerCtxValue } from "../../state/server.state";
import { useIsMenuVisibleValue } from "../../state/visibility.state";
import { useSetListenForExit } from "../../state/keys.state";
import { useDebounce } from "../../hooks/useDebouce";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import PlayerRow from "./PlayerRow";

const MAX_PER_BUCKET = 60;

/**
 * The incrementally loaded list. Advancing the bucket synchronously matters: a
 * delayed loader recreated the observer and cancelled its own timer, stalling at 60.
 */
const PlayersList: React.FC = () => {
  const filteredPlayers = useFilteredSortedPlayers();
  const [bucket, setBucket] = useState(1);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const loadTriggerRef = useRef<HTMLDivElement | null>(null);
  const isMenuVisible = useIsMenuVisibleValue();

  useEffect(() => {
    setBucket((previousBucket) => {
      const highestAvailableBucket = Math.max(1, Math.ceil(filteredPlayers.length / MAX_PER_BUCKET));
      return Math.min(previousBucket, highestAvailableBucket);
    });
  }, [filteredPlayers.length]);

  const visiblePlayers = useMemo(
    () => filteredPlayers.slice(0, MAX_PER_BUCKET * bucket),
    [filteredPlayers, bucket]
  );

  const handleObserver = useCallback(
    ([entry]: IntersectionObserverEntry[]) => {
      if (!isMenuVisible) {
        setBucket(1);
        return;
      }
      if (!entry?.isIntersecting || visiblePlayers.length >= filteredPlayers.length) return;
      const highestAvailableBucket = Math.max(1, Math.ceil(filteredPlayers.length / MAX_PER_BUCKET));
      setBucket((previousBucket) => Math.min(previousBucket + 1, highestAvailableBucket));
    },
    [filteredPlayers.length, isMenuVisible, visiblePlayers.length]
  );

  useEffect(() => {
    const trigger = loadTriggerRef.current;
    const observer = new IntersectionObserver(handleObserver, {
      root: scrollAreaRef.current,
      rootMargin: "120px",
      threshold: 0.1,
    });
    if (trigger) observer.observe(trigger);
    return () => observer.disconnect();
  }, [handleObserver]);

  return (
    <div ref={scrollAreaRef} className="page-scroll">
      <div className="player-grid" role="list">
        {visiblePlayers.map((player) => (
          <div role="listitem" key={player.id}>
            <PlayerRow playerData={player} />
          </div>
        ))}
      </div>
      <div ref={loadTriggerRef} style={{ height: 20 }} />
    </div>
  );
};

/**
 * The player directory: page header, a toolbar (search, filter, sort) and player
 * rows. It stays mounted while hidden, because it owns the player list listener.
 */
export const PlayersPage: React.FC<{ visible: boolean }> = ({ visible }) => {
  const t = useTranslate();
  const players = useFilteredSortedPlayers();
  const allPlayers = usePlayersState();
  const serverCtx = useServerCtxValue();
  const [filterType, setFilterType] = usePlayersFilterBy();
  const [sortType, setSortType] = usePlayersSortBy();
  const [playerSearch, setPlayerSearch] = usePlayersSearch();
  const setPlayersFilterIsTemp = useSetPlayersFilterIsTemp();
  const setListenForExit = useSetListenForExit();
  const [searchVal, setSearchVal] = useState("");
  const debouncedInput = useDebounce<string>(searchVal, 350);

  usePlayerListListener();

  useEffect(() => {
    setPlayerSearch(debouncedInput);
  }, [debouncedInput, setPlayerSearch]);

  useEffect(() => {
    setSearchVal(playerSearch);
  }, [playerSearch]);

  const counts = useMemo(() => ({
    admins: allPlayers.filter((player) => player.admin).length,
    injured: allPlayers.filter((player) => player.health >= 0 && player.health <= 20).length,
    inVehicle: allPlayers.filter((player) => player.vType !== VehicleStatus.Walking).length,
  }), [allPlayers]);

  const currentFilter = filterType ?? PlayerDataFilter.NoFilter;
  const hasActiveQuery = currentFilter !== PlayerDataFilter.NoFilter || searchVal.trim().length > 0;
  const oneSyncLabel = serverCtx.oneSync.status
    ? `OneSync${serverCtx.oneSync.type ? ` ${serverCtx.oneSync.type}` : ""}`
    : t("nui_menu.page_players.misc.onesync_off");

  const clearQuery = () => {
    setSearchVal("");
    setPlayerSearch("");
    setFilterType(PlayerDataFilter.NoFilter);
  };

  return (
    <section
      className="page-window"
      aria-label={t("nui_menu.page_players.misc.online_players")}
      aria-hidden={!visible}
      style={{ display: visible ? "flex" : "none" }}
    >
      <header className="page-header">
        <h1 className="page-title">{t("nui_menu.page_players.misc.players")}</h1>
        <p className="page-subtitle tabular">
          {t("nui_menu.page_players.misc.online_count", {
            online: allPlayers.length,
            max: serverCtx.maxClients,
          })}
          {" · "}
          {oneSyncLabel}
        </p>
      </header>

      <div className="toolbar" role="search">
        <label className="sr-only" htmlFor="player-directory-search">
          {t("nui_menu.page_players.misc.search")}
        </label>
        <input
          id="player-directory-search"
          className="input input-sm"
          type="search"
          placeholder={t("nui_menu.page_players.misc.search")}
          value={searchVal}
          autoComplete="off"
          onChange={(event) => {
            setSearchVal(event.target.value);
            setPlayersFilterIsTemp(false);
          }}
          //Backspace and Escape close the menu unless a field has focus
          onFocus={() => setListenForExit(false)}
          onBlur={() => setListenForExit(true)}
        />
        <Select<PlayerDataFilter>
          small
          aria-label={t("nui_menu.page_players.filter.label")}
          value={currentFilter}
          onChange={setFilterType}
          options={[
            { value: PlayerDataFilter.NoFilter, label: t("nui_menu.page_players.filter.no_filter") },
            { value: PlayerDataFilter.IsAdmin, label: `${t("nui_menu.page_players.filter.is_admin")} (${counts.admins})` },
            { value: PlayerDataFilter.IsInjured, label: `${t("nui_menu.page_players.filter.is_injured")} (${counts.injured})` },
            { value: PlayerDataFilter.InVehicle, label: `${t("nui_menu.page_players.filter.in_vehicle")} (${counts.inVehicle})` },
          ]}
        />
        <Select<PlayerDataSort>
          small
          aria-label={t("nui_menu.page_players.sort.label")}
          value={sortType ?? PlayerDataSort.IdJoinedFirst}
          onChange={setSortType}
          options={[
            { value: PlayerDataSort.IdJoinedFirst, label: `${t("nui_menu.page_players.sort.id")} · ${t("nui_menu.page_players.sort.joined_first")}` },
            { value: PlayerDataSort.IdJoinedLast, label: `${t("nui_menu.page_players.sort.id")} · ${t("nui_menu.page_players.sort.joined_last")}` },
            { value: PlayerDataSort.DistanceClosest, label: `${t("nui_menu.page_players.sort.distance")} · ${t("nui_menu.page_players.sort.closest")}` },
            { value: PlayerDataSort.DistanceFarthest, label: `${t("nui_menu.page_players.sort.distance")} · ${t("nui_menu.page_players.sort.farthest")}` },
          ]}
        />
        {hasActiveQuery && (
          <span className="text-dense text-muted tabular" style={{ marginLeft: "auto" }}>
            {t("nui_menu.page_players.misc.showing_count", { shown: players.length, total: allPlayers.length })}
          </span>
        )}
      </div>

      {players.length ? (
        <PlayersList />
      ) : (
        <div className="page-scroll">
          <div className="empty" role="status">
            <span>{t("nui_menu.page_players.misc.zero_players")}</span>
            {hasActiveQuery && (
              <Button small onClick={clearQuery}>
                {t("nui_menu.page_players.misc.clear_filters")}
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
