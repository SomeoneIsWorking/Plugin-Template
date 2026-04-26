const manifest$1 = {
    name: "Heroic on Deck",
};

// Decky Loader will pass this api in, it's versioned to allow for backwards compatibility.
// @ts-ignore
// Prevents it from being duplicated in output.
const manifest = manifest$1;
const API_VERSION = 1;
const internalAPIConnection = window.__DECKY_SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED_deckyLoaderAPIInit;
// Initialize
if (!internalAPIConnection) {
    throw new Error('[@decky/api]: Failed to connect to the loader as as the loader API was not initialized. This is likely a bug in Decky Loader.');
}
const api = internalAPIConnection.connect(API_VERSION, manifest.name);
api.call;
const callable = api.callable;
api.addEventListener;
api.removeEventListener;
const routerHook = api.routerHook;
api.toaster;
api.openFilePicker;
api.executeInTab;
api.injectCssIntoTab;
api.removeCssFromTab;
api.fetchNoCors;
api.getExternalResourceURL;
const definePlugin = (fn) => {
    return (...args) => {
        // TODO: Maybe wrap this
        return fn(...args);
    };
};

const getBridgeStatus = callable("get_bridge_status");
const doStartHeroic = callable("start_heroic");
const listGames = callable("list_games");
const installGame = callable("install_game");
const deleteGame = callable("delete_game");
const addToSteam = callable("add_to_steam");
const launchGame = callable("launch_game");
const getServicePaths = callable("get_service_paths");
const FULLSCREEN_ROUTE = "/heroic-on-deck/games";
const GamepadIcon = () => (SP_REACT.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 640 512", style: { width: "1em", height: "1em", fill: "currentColor" } },
    SP_REACT.createElement("path", { d: "M480 96H160C71.6 96 0 167.6 0 256s71.6 160 160 160c44.9 0 85.5-18.4 114.8-48H365.2C394.5 397.6 435.1 416 480 416c88.4 0 160-71.6 160-160S568.4 96 480 96zM232 280h-48v48h-48v-48H88v-48h48v-48h48v48h48v48zm168-24c-13.3 0-24-10.7-24-24s10.7-24 24-24 24 10.7 24 24-10.7 24-24 24zm64 64c-13.3 0-24-10.7-24-24s10.7-24 24-24 24 10.7 24 24-10.7 24-24 24zm0-128c-13.3 0-24-10.7-24-24s10.7-24 24-24 24 10.7 24 24-10.7 24-24 24zm64 64c-13.3 0-24-10.7-24-24s10.7-24 24-24 24 10.7 24 24-10.7 24-24 24z" })));
const GameCard = ({ game, onAction }) => {
    const [busy, setBusy] = SP_REACT.useState(false);
    const run = async (fn) => {
        setBusy(true);
        try {
            await fn();
        }
        finally {
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
    return (SP_REACT.createElement("div", { style: {
            borderRadius: 14,
            overflow: "hidden",
            border: "1px solid #23374d",
            background: "linear-gradient(170deg, #0d1724 0%, #111f2f 100%)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        } },
        SP_REACT.createElement("div", { style: { position: "relative", height: 220, background: "#122033" } },
            game.boxArt ? (SP_REACT.createElement("img", { src: game.boxArt, alt: "", style: { width: "100%", height: "100%", objectFit: "cover", opacity: 0.95 } })) : null,
            SP_REACT.createElement("div", { style: {
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(to top, rgba(3,8,13,0.95) 0%, rgba(3,8,13,0.28) 62%, rgba(3,8,13,0.0) 100%)",
                } }),
            SP_REACT.createElement("div", { style: {
                    position: "absolute",
                    left: 12,
                    right: 12,
                    bottom: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                } },
                SP_REACT.createElement("div", { style: {
                        color: "#f2f6fb",
                        fontWeight: 700,
                        fontSize: 16,
                        lineHeight: 1.2,
                        textShadow: "0 2px 10px rgba(0,0,0,0.7)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    } }, game.title),
                SP_REACT.createElement("div", { style: {
                        flexShrink: 0,
                        borderRadius: 999,
                        padding: "4px 10px",
                        background: "rgba(6, 12, 20, 0.85)",
                        border: `1px solid ${chipColor}`,
                        color: chipColor,
                        fontSize: 11,
                        fontWeight: 700,
                    } }, statusLabel))),
        SP_REACT.createElement("div", { style: { padding: 10 } }, isActive ? (SP_REACT.createElement(SP_REACT.Fragment, null,
            SP_REACT.createElement("div", { style: { marginBottom: 8 } },
                SP_REACT.createElement(DFL.ProgressBar, { nProgress: pct })),
            SP_REACT.createElement("div", { style: { fontSize: 11, color: "#9fb3c8", padding: "4px 2px 2px" } }, "Live install status updates every 4 seconds."))) : (SP_REACT.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 4 } }, !game.isInstalled ? (SP_REACT.createElement(DFL.ButtonItem, { layout: "below", onClick: () => run(() => installGame(game.appName, game.runner)), disabled: busy }, "Install")) : (SP_REACT.createElement(SP_REACT.Fragment, null,
            SP_REACT.createElement(DFL.ButtonItem, { layout: "below", onClick: () => run(() => launchGame(game.appName, game.runner)), disabled: busy }, "Launch"),
            SP_REACT.createElement(DFL.ButtonItem, { layout: "below", onClick: () => run(() => addToSteam(game.appName, game.runner)), disabled: busy }, "Add to Steam"),
            SP_REACT.createElement(DFL.ButtonItem, { layout: "below", onClick: () => run(() => deleteGame(game.appName, game.runner)), disabled: busy }, "Delete Files"))))))));
};
const GameLibraryPage = () => {
    const [bridge, setBridge] = SP_REACT.useState(null);
    const [games, setGames] = SP_REACT.useState([]);
    const [paths, setPaths] = SP_REACT.useState(null);
    const [starting, setStarting] = SP_REACT.useState(false);
    const [startError, setStartError] = SP_REACT.useState(null);
    const [query, setQuery] = SP_REACT.useState("");
    const [installedOnly, setInstalledOnly] = SP_REACT.useState(false);
    const refresh = SP_REACT.useCallback(async () => {
        try {
            const status = await getBridgeStatus(false);
            setBridge(status);
            if (status.ok) {
                const [g, p] = await Promise.all([listGames("legendary"), getServicePaths()]);
                setGames(g);
                setPaths(p);
            }
        }
        catch (_) {
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
            }
            else {
                setStartError(result.message ?? "Failed to start Heroic.");
            }
        }
        catch (e) {
            setStartError(String(e));
        }
        finally {
            setStarting(false);
        }
    };
    SP_REACT.useEffect(() => {
        void refresh();
        const id = setInterval(() => void refresh(), 4000);
        return () => clearInterval(id);
    }, [refresh]);
    const filteredGames = SP_REACT.useMemo(() => {
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
    const installedCount = SP_REACT.useMemo(() => games.filter((game) => game.isInstalled).length, [games]);
    const activeCount = SP_REACT.useMemo(() => games.filter((game) => ["installing", "updating", "queued"].includes(game.status)).length, [games]);
    if (bridge === null) {
        return SP_REACT.createElement("div", { style: { padding: 24, color: "#9db4cb" } }, "Connecting to Heroic...");
    }
    if (!bridge.ok) {
        return (SP_REACT.createElement("div", { style: { padding: 24 } },
            SP_REACT.createElement("div", { style: {
                    maxWidth: 740,
                    borderRadius: 16,
                    background: "linear-gradient(165deg, #131f2f 0%, #0e1825 100%)",
                    border: "1px solid #29405a",
                    padding: 18,
                } },
                SP_REACT.createElement("div", { style: { color: "#f2f6fb", fontSize: 24, fontWeight: 700, marginBottom: 8 } }, "Heroic Is Offline"),
                SP_REACT.createElement("div", { style: { color: "#9db4cb", fontSize: 13, marginBottom: 12 } }, bridge.message ?? "Heroic bridge unavailable."),
                SP_REACT.createElement(DFL.ButtonItem, { layout: "below", onClick: handleStart, disabled: starting }, starting ? "Starting Heroic..." : "Start Heroic Service"),
                startError ? (SP_REACT.createElement("div", { style: { color: "#f78a8a", fontSize: 12, marginTop: 8 } }, startError)) : null)));
    }
    return (SP_REACT.createElement("div", { style: {
            minHeight: "100%",
            padding: 18,
            background: "radial-gradient(1200px 500px at -10% -20%, rgba(56, 189, 248, 0.15), rgba(0,0,0,0) 60%), radial-gradient(1200px 500px at 110% -10%, rgba(244, 114, 182, 0.12), rgba(0,0,0,0) 58%), linear-gradient(180deg, #09111b 0%, #0b1521 100%)",
        } },
        SP_REACT.createElement("div", { style: {
                border: "1px solid #1d344a",
                background: "linear-gradient(155deg, #0f1d2c 0%, #122338 65%, #0e1b2a 100%)",
                borderRadius: 16,
                padding: 16,
                marginBottom: 14,
                boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
            } },
            SP_REACT.createElement("div", { style: { color: "#f2f6fb", fontSize: 30, fontWeight: 800, marginBottom: 4 } }, "Heroic Launcher"),
            SP_REACT.createElement("div", { style: { color: "#9ab2c8", fontSize: 13, marginBottom: 12 } }, "Browse and manage your Epic library with launcher-style controls."),
            SP_REACT.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 } },
                SP_REACT.createElement("div", { style: {
                        border: "1px solid #314b65",
                        borderRadius: 999,
                        padding: "4px 10px",
                        color: "#95d4ff",
                        fontSize: 12,
                        fontWeight: 700,
                        background: "rgba(21, 43, 62, 0.72)",
                    } },
                    games.length,
                    " Total"),
                SP_REACT.createElement("div", { style: {
                        border: "1px solid #2e6a59",
                        borderRadius: 999,
                        padding: "4px 10px",
                        color: "#83e5bf",
                        fontSize: 12,
                        fontWeight: 700,
                        background: "rgba(21, 52, 42, 0.72)",
                    } },
                    installedCount,
                    " Installed"),
                SP_REACT.createElement("div", { style: {
                        border: "1px solid #67513a",
                        borderRadius: 999,
                        padding: "4px 10px",
                        color: "#efce99",
                        fontSize: 12,
                        fontWeight: 700,
                        background: "rgba(51, 39, 25, 0.72)",
                    } },
                    activeCount,
                    " Active Jobs")),
            SP_REACT.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
                SP_REACT.createElement("input", { value: query, onChange: (event) => setQuery(event.target.value), placeholder: "Search your games...", style: {
                        flex: "1 1 320px",
                        minWidth: 240,
                        borderRadius: 10,
                        border: "1px solid #31506f",
                        background: "#0b1724",
                        color: "#dbe9f6",
                        fontSize: 13,
                        padding: "9px 12px",
                        outline: "none",
                    } }),
                SP_REACT.createElement("button", { type: "button", onClick: () => setInstalledOnly((value) => !value), style: {
                        borderRadius: 10,
                        border: installedOnly ? "1px solid #67e8a5" : "1px solid #38516a",
                        background: installedOnly ? "#123025" : "#142434",
                        color: installedOnly ? "#9af0c4" : "#c5d8ea",
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "0 14px",
                        minHeight: 37,
                    } }, installedOnly ? "Showing Installed" : "Show Installed Only"))),
        filteredGames.length === 0 ? (SP_REACT.createElement("div", { style: { color: "#9ab2c8", fontSize: 13, padding: "10px 6px" } }, "No games match your current filter.")) : (SP_REACT.createElement("div", { style: {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))",
                gap: 12,
            } }, filteredGames.map((game) => (SP_REACT.createElement(GameCard, { key: game.appName, game: game, onAction: refresh }))))),
        SP_REACT.createElement("div", { style: {
                marginTop: 16,
                borderRadius: 12,
                border: "1px solid #1d3348",
                background: "rgba(11, 23, 35, 0.8)",
                padding: 10,
            } },
            SP_REACT.createElement("div", { style: { color: "#7f99b2", fontSize: 11, marginBottom: 4 } }, "Heroic File Disclaimer"),
            paths ? (SP_REACT.createElement("div", { style: { color: "#9ab2c8", fontSize: 10, lineHeight: 1.5, wordBreak: "break-all" } },
                "Config: ",
                paths.heroicConfigJson,
                SP_REACT.createElement("br", null),
                "GamesConfig: ",
                paths.heroicGamesConfigRoot,
                SP_REACT.createElement("br", null),
                "Legendary installed map: ",
                paths.legendaryInstalledJson,
                SP_REACT.createElement("br", null),
                "Legendary metadata: ",
                paths.legendaryMetadataRoot,
                SP_REACT.createElement("br", null),
                "Decky state: ",
                paths.deckyStateJson,
                SP_REACT.createElement("br", null),
                "Legendary binary: ",
                paths.legendaryBinary,
                SP_REACT.createElement("br", null),
                "Default install path: ",
                paths.defaultInstallPath)) : (SP_REACT.createElement("div", { style: { color: "#7f99b2", fontSize: 10 } }, "Loading file paths...")))));
};
const Content = () => {
    const openFullscreenGames = () => {
        DFL.Navigation.CloseSideMenus();
        DFL.Navigation.Navigate(FULLSCREEN_ROUTE);
    };
    return (SP_REACT.createElement(DFL.PanelSection, { title: "Heroic on Deck" },
        SP_REACT.createElement(DFL.PanelSectionRow, null,
            SP_REACT.createElement("span", { style: { color: "#95a7ba", fontSize: 12 } }, "Open the fullscreen launcher to browse your Heroic Epic library.")),
        SP_REACT.createElement(DFL.PanelSectionRow, null,
            SP_REACT.createElement(DFL.ButtonItem, { layout: "below", onClick: openFullscreenGames }, "Open Fullscreen Launcher"))));
};
var index = definePlugin(() => {
    routerHook.addRoute(FULLSCREEN_ROUTE, GameLibraryPage, {
        exact: true,
    });
    return {
        name: "Heroic on Deck",
        titleView: SP_REACT.createElement("div", { className: DFL.staticClasses.Title }, "Heroic on Deck"),
        content: SP_REACT.createElement(Content, null),
        icon: SP_REACT.createElement(GamepadIcon, null),
        onDismount() {
            routerHook.removeRoute(FULLSCREEN_ROUTE);
        },
    };
});

export { index as default };
