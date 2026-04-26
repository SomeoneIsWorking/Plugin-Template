import { callable, definePlugin, routerHook } from "@decky/api";
import {
  ButtonItem,
  Navigation,
  ProgressBar,
  PanelSection,
  PanelSectionRow,
  staticClasses,
} from "@decky/ui";
import React, { FC, useCallback, useEffect, useMemo, useState } from "react";

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

interface ServicePaths {
  heroicConfigRoot: string;
  heroicConfigJson: string;
  heroicGamesConfigRoot: string;
  legendaryConfigRoot: string;
  legendaryMetadataRoot: string;
  legendaryInstalledJson: string;
  deckyStateJson: string;
  legendaryBinary: string;
  defaultInstallPath: string;
}

const getBridgeStatus = callable<[boolean], BridgeStatus>("get_bridge_status");
const doStartHeroic = callable<[], BridgeStatus>("start_heroic");
const listGames = callable<[string], GameEntry[]>("list_games");
const installGame = callable<[string, string], object>("install_game");
const deleteGame = callable<[string, string], object>("delete_game");
const addToSteam = callable<[string, string], object>("add_to_steam");
const launchGame = callable<[string, string], object>("launch_game");
const getServicePaths = callable<[], ServicePaths>("get_service_paths");

const FULLSCREEN_ROUTE = "/heroic-on-deck/games";

const GamepadIcon: FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 640 512"
    style={{ width: "1em", height: "1em", fill: "currentColor" }}
  >
    <path d="M480 96H160C71.6 96 0 167.6 0 256s71.6 160 160 160c44.9 0 85.5-18.4 114.8-48H365.2C394.5 397.6 435.1 416 480 416c88.4 0 160-71.6 160-160S568.4 96 480 96zM232 280h-48v48h-48v-48H88v-48h48v-48h48v48h48v48zm168-24c-13.3 0-24-10.7-24-24s10.7-24 24-24 24 10.7 24 24-10.7 24-24 24zm64 64c-13.3 0-24-10.7-24-24s10.7-24 24-24 24 10.7 24 24-10.7 24-24 24zm0-128c-13.3 0-24-10.7-24-24s10.7-24 24-24 24 10.7 24 24-10.7 24-24 24zm64 64c-13.3 0-24-10.7-24-24s10.7-24 24-24 24 10.7 24 24-10.7 24-24 24z" />
  </svg>
);

const GameCard: FC<{ game: GameEntry; onAction: () => void }> = ({ game, onAction }) => {
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

  const isActive = game.status === "installing" || game.status === "updating" || game.status === "queued";
  const pct = (game.progress?.percent ?? 0) / 100;

  const statusLabel = isActive
    ? game.status === "queued"
      ? "Queued"
      : `Downloading ${((game.progress?.percent ?? 0)).toFixed(0)}%`
    : game.isInstalled
    ? "Installed"
    : "Not Installed";

  const chipColor = isActive ? "#61dafb" : game.isInstalled ? "#67e8a5" : "#f2c76e";

  return (
    <div
      style={{
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid #23374d",
        background: "linear-gradient(170deg, #0d1724 0%, #111f2f 100%)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ position: "relative", height: 220, background: "#122033" }}>
        {game.boxArt ? (
          <img
            src={game.boxArt}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.95 }}
          />
        ) : null}

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(3,8,13,0.95) 0%, rgba(3,8,13,0.28) 62%, rgba(3,8,13,0.0) 100%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div
            style={{
              color: "#f2f6fb",
              fontWeight: 700,
              fontSize: 16,
              lineHeight: 1.2,
              textShadow: "0 2px 10px rgba(0,0,0,0.7)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {game.title}
          </div>
          <div
            style={{
              flexShrink: 0,
              borderRadius: 999,
              padding: "4px 10px",
              background: "rgba(6, 12, 20, 0.85)",
              border: `1px solid ${chipColor}`,
              color: chipColor,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {statusLabel}
          </div>
        </div>
      </div>

      <div style={{ padding: 10 }}>
        {isActive ? (
          <>
            <div style={{ marginBottom: 8 }}>
              <ProgressBar nProgress={pct} />
            </div>
            <div style={{ fontSize: 11, color: "#9fb3c8", padding: "4px 2px 2px" }}>
              Live install status updates every 4 seconds.
            </div>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {!game.isInstalled ? (
              <ButtonItem
                layout="below"
                onClick={() => run(() => installGame(game.appName, game.runner))}
                disabled={busy}
              >
                Install
              </ButtonItem>
            ) : (
              <>
                <ButtonItem
                  layout="below"
                  onClick={() => run(() => launchGame(game.appName, game.runner))}
                  disabled={busy}
                >
                  Launch
                </ButtonItem>
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
                  Delete Files
                </ButtonItem>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const GameLibraryPage: FC = () => {
  const [bridge, setBridge] = useState<BridgeStatus | null>(null);
  const [games, setGames] = useState<GameEntry[]>([]);
  const [paths, setPaths] = useState<ServicePaths | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [installedOnly, setInstalledOnly] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const status = await getBridgeStatus(false);
      setBridge(status);
      if (status.ok) {
        const [g, p] = await Promise.all([listGames("legendary"), getServicePaths()]);
        setGames(g);
        setPaths(p);
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
        const [g, p] = await Promise.all([listGames("legendary"), getServicePaths()]);
        setGames(g);
        setPaths(p);
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

  const filteredGames = useMemo(() => {
    const q = query.trim().toLowerCase();
    return games
      .filter((game) => (installedOnly ? game.isInstalled : true))
      .filter((game) => (q.length === 0 ? true : game.title.toLowerCase().includes(q)))
      .sort((a, b) => {
        if (a.isInstalled !== b.isInstalled) {
          return a.isInstalled ? -1 : 1;
        }
        return a.title.localeCompare(b.title);
      });
  }, [games, installedOnly, query]);

  const installedCount = useMemo(() => games.filter((game) => game.isInstalled).length, [games]);
  const activeCount = useMemo(
    () => games.filter((game) => ["installing", "updating", "queued"].includes(game.status)).length,
    [games],
  );

  if (bridge === null) {
    return <div style={{ padding: 24, color: "#9db4cb" }}>Connecting to Heroic...</div>;
  }

  if (!bridge.ok) {
    return (
      <div style={{ padding: 24 }}>
        <div
          style={{
            maxWidth: 740,
            borderRadius: 16,
            background: "linear-gradient(165deg, #131f2f 0%, #0e1825 100%)",
            border: "1px solid #29405a",
            padding: 18,
          }}
        >
          <div style={{ color: "#f2f6fb", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
            Heroic Is Offline
          </div>
          <div style={{ color: "#9db4cb", fontSize: 13, marginBottom: 12 }}>
            {bridge.message ?? "Heroic bridge unavailable."}
          </div>
          <ButtonItem layout="below" onClick={handleStart} disabled={starting}>
            {starting ? "Starting Heroic..." : "Start Heroic Service"}
          </ButtonItem>
          {startError ? (
            <div style={{ color: "#f78a8a", fontSize: 12, marginTop: 8 }}>{startError}</div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100%",
        padding: 18,
        background:
          "radial-gradient(1200px 500px at -10% -20%, rgba(56, 189, 248, 0.15), rgba(0,0,0,0) 60%), radial-gradient(1200px 500px at 110% -10%, rgba(244, 114, 182, 0.12), rgba(0,0,0,0) 58%), linear-gradient(180deg, #09111b 0%, #0b1521 100%)",
      }}
    >
      <div
        style={{
          border: "1px solid #1d344a",
          background: "linear-gradient(155deg, #0f1d2c 0%, #122338 65%, #0e1b2a 100%)",
          borderRadius: 16,
          padding: 16,
          marginBottom: 14,
          boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ color: "#f2f6fb", fontSize: 30, fontWeight: 800, marginBottom: 4 }}>
          Heroic Launcher
        </div>
        <div style={{ color: "#9ab2c8", fontSize: 13, marginBottom: 12 }}>
          Browse and manage your Epic library with launcher-style controls.
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <div
            style={{
              border: "1px solid #314b65",
              borderRadius: 999,
              padding: "4px 10px",
              color: "#95d4ff",
              fontSize: 12,
              fontWeight: 700,
              background: "rgba(21, 43, 62, 0.72)",
            }}
          >
            {games.length} Total
          </div>
          <div
            style={{
              border: "1px solid #2e6a59",
              borderRadius: 999,
              padding: "4px 10px",
              color: "#83e5bf",
              fontSize: 12,
              fontWeight: 700,
              background: "rgba(21, 52, 42, 0.72)",
            }}
          >
            {installedCount} Installed
          </div>
          <div
            style={{
              border: "1px solid #67513a",
              borderRadius: 999,
              padding: "4px 10px",
              color: "#efce99",
              fontSize: 12,
              fontWeight: 700,
              background: "rgba(51, 39, 25, 0.72)",
            }}
          >
            {activeCount} Active Jobs
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your games..."
            style={{
              flex: "1 1 320px",
              minWidth: 240,
              borderRadius: 10,
              border: "1px solid #31506f",
              background: "#0b1724",
              color: "#dbe9f6",
              fontSize: 13,
              padding: "9px 12px",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={() => setInstalledOnly((value) => !value)}
            style={{
              borderRadius: 10,
              border: installedOnly ? "1px solid #67e8a5" : "1px solid #38516a",
              background: installedOnly ? "#123025" : "#142434",
              color: installedOnly ? "#9af0c4" : "#c5d8ea",
              fontSize: 12,
              fontWeight: 700,
              padding: "0 14px",
              minHeight: 37,
            }}
          >
            {installedOnly ? "Showing Installed" : "Show Installed Only"}
          </button>
        </div>
      </div>

      {filteredGames.length === 0 ? (
        <div style={{ color: "#9ab2c8", fontSize: 13, padding: "10px 6px" }}>
          No games match your current filter.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))",
            gap: 12,
          }}
        >
          {filteredGames.map((game) => (
            <GameCard key={game.appName} game={game} onAction={refresh} />
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: 16,
          borderRadius: 12,
          border: "1px solid #1d3348",
          background: "rgba(11, 23, 35, 0.8)",
          padding: 10,
        }}
      >
        <div style={{ color: "#7f99b2", fontSize: 11, marginBottom: 4 }}>Heroic File Disclaimer</div>
        {paths ? (
          <div style={{ color: "#9ab2c8", fontSize: 10, lineHeight: 1.5, wordBreak: "break-all" }}>
            Config: {paths.heroicConfigJson}
            <br />
            GamesConfig: {paths.heroicGamesConfigRoot}
            <br />
            Legendary installed map: {paths.legendaryInstalledJson}
            <br />
            Legendary metadata: {paths.legendaryMetadataRoot}
            <br />
            Decky state: {paths.deckyStateJson}
            <br />
            Legendary binary: {paths.legendaryBinary}
            <br />
            Default install path: {paths.defaultInstallPath}
          </div>
        ) : (
          <div style={{ color: "#7f99b2", fontSize: 10 }}>Loading file paths...</div>
        )}
      </div>
    </div>
  );
};

const Content: FC = () => {
  const openFullscreenGames = () => {
    Navigation.CloseSideMenus();
    Navigation.Navigate(FULLSCREEN_ROUTE);
  };

  return (
    <PanelSection title="Heroic on Deck">
      <PanelSectionRow>
        <span style={{ color: "#95a7ba", fontSize: 12 }}>
          Open the fullscreen launcher to browse your Heroic Epic library.
        </span>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={openFullscreenGames}>
          Open Fullscreen Launcher
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
  );
};

export default definePlugin(() => {
  routerHook.addRoute(FULLSCREEN_ROUTE, GameLibraryPage, {
    exact: true,
  });

  return {
    name: "Heroic on Deck",
    titleView: <div className={staticClasses.Title}>Heroic on Deck</div>,
    content: <Content />,
    icon: <GamepadIcon />,
    onDismount() {
      routerHook.removeRoute(FULLSCREEN_ROUTE);
    },
  };
});
