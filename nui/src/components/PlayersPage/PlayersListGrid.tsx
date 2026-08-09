import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFilteredSortedPlayers } from "../../state/players.state";
import PlayerCard from "./PlayerCard";
import { Box, styled } from "@mui/material";
import { useIsMenuVisibleValue } from "@nui/src/state/visibility.state";

const MAX_PER_BUCKET = 60;

const ScrollArea = styled("div")({
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  overflowX: "hidden",
  padding: "16px 18px 18px",
  scrollbarGutter: "stable",
});

const PlayerGrid = styled(Box)({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(285px, 1fr))",
  gap: 10,
});

const LoadTrigger = styled("div")({
  height: 20,
});

export const PlayersListGrid: React.FC = () => {
  const filteredPlayers = useFilteredSortedPlayers();
  const [bucket, setBucket] = useState(1);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const loadTriggerRef = useRef<HTMLDivElement | null>(null);
  const isMenuVisible = useIsMenuVisibleValue();

  useEffect(() => {
    setBucket((previousBucket) => {
      const highestAvailableBucket = Math.max(
        1,
        Math.ceil(filteredPlayers.length / MAX_PER_BUCKET)
      );
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

      if (
        !entry?.isIntersecting ||
        visiblePlayers.length >= filteredPlayers.length
      ) {
        return;
      }

      //Advance synchronously. The previous delayed loader recreated the
      //observer when `loadingMore` changed, and its cleanup cancelled the very
      //timer responsible for clearing that state, permanently stalling at 60.
      const highestAvailableBucket = Math.max(
        1,
        Math.ceil(filteredPlayers.length / MAX_PER_BUCKET)
      );
      setBucket((previousBucket) =>
        Math.min(previousBucket + 1, highestAvailableBucket)
      );
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

    return () => {
      observer.disconnect();
    };
  }, [handleObserver]);

  return (
    <ScrollArea ref={scrollAreaRef}>
      <PlayerGrid>
        {visiblePlayers.map((player) => (
          <PlayerCard playerData={player} key={player.id} />
        ))}
      </PlayerGrid>
      <LoadTrigger ref={loadTriggerRef} />
    </ScrollArea>
  );
};
