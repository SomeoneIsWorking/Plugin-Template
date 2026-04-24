import { callable, definePlugin } from "@decky/api";
import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  ProgressBar,
  staticClasses,
} from "@decky/ui";
import React, { FC, useCallback, useEffect, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface InstallProgress {
  percent?: number;
  bytes?: string;
  eta?: string;
}

interface GameEntry {
  appName: string;
  title: string;
  runner: string;
  isInstalled: boolean;
  status: string;
  progress: InstallProgress | null;
  boxArt: string;
}

interface BridgeStatus {
  ok: boolean;
  port?: number;
  started?: boolean;
  message?: string;
}

// ── Backend callables ────────────────────────────────────────────────────────

const getBridgeStatus = callable<[boolean], BridgeStatus>("get_bridge_status");
const doStartHeroic = callable<[], BridgeStatus>("start_heroic");
const listGames = callable<[string], GameEntry[]>("list_games");
const installGame = callable<[string, string], object>("install_game");
const deleteGame = callable<[string, string], object>("delete_game");
const addToSteam = callable<[string, string], object>("add_to_steam");

// ── Inline SVG icon (gamepad) ────────────────────────────────────────────────

const GamepadIcon: FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 640 512"
    style={{ width: "1em", height: "1em", fill: "currentColor" }}
  >
    <path d="M480 96H160C71.6 96 0 167.6 0 256s71.6 160 160 160c44.9 0 85.5-18.4 114.8-48H365.2C394.5 397.6 435.1 416 480 416c88.4 0 160-71.6 160-160S568.4 96 480 96zM232 280h-48v48h-48v-48H88v-48h48v-48h48v48h48v48zm168-24c-13.3 0-24-10.7-24-24s10.7-24 24-24 24 10.7 24 24-10.7 24-24 24zm64 64c-13.3 0-24-10.7-24-24s10.7-24 24-24 24 10.7 24 24-10.7 24-24 24zm0-128c-13.3 0-24-10.7-24-24s10.7-24 24-24 24 10.7 24 24-10.7 24-24 24zm64 64c-13.3 0-24-10.7-24-24s10.7-24 24-24 24 10.7 24 24-10.7 24-24 24z" />
  </svg>
);

// ── GameCard ──────────────────────────────────────────────────────────────────

const GameCard: FC<{ game: GameEntry; onAction: () => void }> = ({
  game,
  onAction,
}) => {
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
      onAction();
    }
  };

  const isActive =
    game.status === "installing" ||
    game.status === "updating" ||
    game.status === "queued";
  const pct = (game.progress?.percent ?? 0) / 100;

  const statusLabel = isActive
    ? game.status === "queued"
      ? "Queued…"
      : `Downloading ${((game.progress?.percent ?? 0)).toFixed(0)}%`
    : game.isInstalled
    ? "Installed"
    : "Not installed";

  return (
    <div style={{ paddingBottom: 12 }}>
      {/* Title row with thumbnail */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        {game.boxArt ? (
          <img
            src={game.boxArt}
            alt=""
            style={{
              width: 36,
              height: 48,
              objectFit: "cover",
              borderRadius: 4,
              flexShrink: 0,
              background: "#1a2735",
            }}
          />
        ) : (
          <div
            style={{
              width: 36,
              height: 48,
              borderRadius: 4,
              background: "#1a2735",
              flexShrink: 0,
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {game.title}
          </div>
          <div style={{ fontSize: 11, color: "#95a7ba", marginTop: 2 }}>
            {statusLabel}
          </div>
          {isActive && (
            <div style={{ marginTop: 4 }}>
              <ProgressBar nProgress={pct} />
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {!isActive && (
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
          {!game.isInstalled && (
            <ButtonItem
              layout="below"
              onClick={() => run(() => installGame(game.appName, game.runner))}
              disabled={busy}
            >
              Install
            </ButtonItem>
          )}
          {game.isInstalled && (
            <>
              <ButtonItem
                layout="below"
                onClick={() => run(() => addToSteam(game.appName, game.runner))}
                disabled={busy}
              >
                Add to Steam
              </ButtonItem>
              <ButtonItem
                layout="below"
                onClick={() => run(() => deleteGame(game.appName, game.runner))}
                disabled={busy}
              >
                Delete files
              </ButtonItem>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main panel content ────────────────────────────────────────────────────────

const Content: FC = () => {
  const [bridge, setBridge] = useState<BridgeStatus | null>(null);
  const [games, setGames] = useState<GameEntry[]>([]);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const status = await getBridgeStatus(false);
      setBridge(status);
      if (status.ok) {
        const g = await listGames("legendary");
        setGames(g);
      }
    } catch (_) {
      // keep existing state; will retry on next interval
    }
  }, []);

  const handleStart = async () => {
    setStarting(true);
    setStartError(null);
    try {
      const result = await doStartHeroic();
      setBridge(result);
      if (result.ok) {
        const g = await listGames("legendary");
        setGames(g);
      } else {
        setStartError(result.message ?? "Failed to start Heroic.");
      }
    } catch (e) {
      setStartError(String(e));
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 4000);
    return () => clearInterval(id);
  }, [refresh]);

  // Loading
  if (bridge === null) {
    return (
      <PanelSection>
        <PanelSectionRow>
          <span style={{ color: "#95a7ba", fontSize: 13 }}>
            Connecting to Heroic…
          </span>
        </PanelSectionRow>
      </PanelSection>
    );
  }

  // Bridge unavailable
  if (!bridge.ok) {
    return (
      <PanelSection title="Heroic not running">
        <PanelSectionRow>
          <span style={{ color: "#95a7ba", fontSize: 12 }}>
            {bridge.message ?? "Heroic bridge unavailable."}
          </span>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={handleStart}
            disabled={starting}
          >
            {starting ? "Starting Heroic…" : "Start Heroic"}
          </ButtonItem>
        </PanelSectionRow>
        {startError && (
          <PanelSectionRow>
            <span style={{ color: "#de5d5d", fontSize: 12 }}>{startError}</span>
          </PanelSectionRow>
        )}
      </PanelSection>
    );
  }

  // Connected
  return (
    <PanelSection title="Epic Games">
      {games.length === 0 ? (
        <PanelSectionRow>
          <span style={{ color: "#95a7ba", fontSize: 13 }}>
            No Epic games found in Heroic.
          </span>
        </PanelSectionRow>
      ) : (
        games.map((game) => (
          <PanelSectionRow key={game.appName}>
            <GameCard game={game} onAction={refresh} />
          </PanelSectionRow>
        ))
      )}
    </PanelSection>
  );
};

// ── Plugin export ─────────────────────────────────────────────────────────────

export default definePlugin(() => ({
  name: "Heroic on Deck",
  titleView: (
    <div className={staticClasses.Title}>Heroic on Deck</div>
  ),
  content: <Content />,
  icon: <GamepadIcon />,
  onDismount() {
    // nothing to tear down; setInterval cleaned up by Content's useEffect
  },
}));
