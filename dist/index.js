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
api.routerHook;
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

// ── Backend callables ────────────────────────────────────────────────────────
const getBridgeStatus = callable("get_bridge_status");
const doStartHeroic = callable("start_heroic");
const listGames = callable("list_games");
const installGame = callable("install_game");
const deleteGame = callable("delete_game");
const addToSteam = callable("add_to_steam");
// ── Inline SVG icon (gamepad) ────────────────────────────────────────────────
const GamepadIcon = () => (SP_REACT.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 640 512", style: { width: "1em", height: "1em", fill: "currentColor" } },
    SP_REACT.createElement("path", { d: "M480 96H160C71.6 96 0 167.6 0 256s71.6 160 160 160c44.9 0 85.5-18.4 114.8-48H365.2C394.5 397.6 435.1 416 480 416c88.4 0 160-71.6 160-160S568.4 96 480 96zM232 280h-48v48h-48v-48H88v-48h48v-48h48v48h48v48zm168-24c-13.3 0-24-10.7-24-24s10.7-24 24-24 24 10.7 24 24-10.7 24-24 24zm64 64c-13.3 0-24-10.7-24-24s10.7-24 24-24 24 10.7 24 24-10.7 24-24 24zm0-128c-13.3 0-24-10.7-24-24s10.7-24 24-24 24 10.7 24 24-10.7 24-24 24zm64 64c-13.3 0-24-10.7-24-24s10.7-24 24-24 24 10.7 24 24-10.7 24-24 24z" })));
// ── GameCard ──────────────────────────────────────────────────────────────────
const GameCard = ({ game, onAction, }) => {
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
    const isActive = game.status === "installing" ||
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
    return (SP_REACT.createElement("div", { style: { paddingBottom: 12 } },
        SP_REACT.createElement("div", { style: { display: "flex", gap: 8, alignItems: "flex-start" } },
            game.boxArt ? (SP_REACT.createElement("img", { src: game.boxArt, alt: "", style: {
                    width: 36,
                    height: 48,
                    objectFit: "cover",
                    borderRadius: 4,
                    flexShrink: 0,
                    background: "#1a2735",
                } })) : (SP_REACT.createElement("div", { style: {
                    width: 36,
                    height: 48,
                    borderRadius: 4,
                    background: "#1a2735",
                    flexShrink: 0,
                } })),
            SP_REACT.createElement("div", { style: { flex: 1, minWidth: 0 } },
                SP_REACT.createElement("div", { style: {
                        fontSize: 13,
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    } }, game.title),
                SP_REACT.createElement("div", { style: { fontSize: 11, color: "#95a7ba", marginTop: 2 } }, statusLabel),
                isActive && (SP_REACT.createElement("div", { style: { marginTop: 4 } },
                    SP_REACT.createElement(DFL.ProgressBar, { nProgress: pct }))))),
        !isActive && (SP_REACT.createElement("div", { style: { marginTop: 6, display: "flex", flexDirection: "column", gap: 4 } },
            !game.isInstalled && (SP_REACT.createElement(DFL.ButtonItem, { layout: "below", onClick: () => run(() => installGame(game.appName, game.runner)), disabled: busy }, "Install")),
            game.isInstalled && (SP_REACT.createElement(SP_REACT.Fragment, null,
                SP_REACT.createElement(DFL.ButtonItem, { layout: "below", onClick: () => run(() => addToSteam(game.appName, game.runner)), disabled: busy }, "Add to Steam"),
                SP_REACT.createElement(DFL.ButtonItem, { layout: "below", onClick: () => run(() => deleteGame(game.appName, game.runner)), disabled: busy }, "Delete files")))))));
};
// ── Main panel content ────────────────────────────────────────────────────────
const Content = () => {
    const [bridge, setBridge] = SP_REACT.useState(null);
    const [games, setGames] = SP_REACT.useState([]);
    const [starting, setStarting] = SP_REACT.useState(false);
    const [startError, setStartError] = SP_REACT.useState(null);
    const refresh = SP_REACT.useCallback(async () => {
        try {
            const status = await getBridgeStatus(false);
            setBridge(status);
            if (status.ok) {
                const g = await listGames("legendary");
                setGames(g);
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
                const g = await listGames("legendary");
                setGames(g);
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
    // Loading
    if (bridge === null) {
        return (SP_REACT.createElement(DFL.PanelSection, null,
            SP_REACT.createElement(DFL.PanelSectionRow, null,
                SP_REACT.createElement("span", { style: { color: "#95a7ba", fontSize: 13 } }, "Connecting to Heroic\u2026"))));
    }
    // Bridge unavailable
    if (!bridge.ok) {
        return (SP_REACT.createElement(DFL.PanelSection, { title: "Heroic not running" },
            SP_REACT.createElement(DFL.PanelSectionRow, null,
                SP_REACT.createElement("span", { style: { color: "#95a7ba", fontSize: 12 } }, bridge.message ?? "Heroic bridge unavailable.")),
            SP_REACT.createElement(DFL.PanelSectionRow, null,
                SP_REACT.createElement(DFL.ButtonItem, { layout: "below", onClick: handleStart, disabled: starting }, starting ? "Starting Heroic…" : "Start Heroic")),
            startError && (SP_REACT.createElement(DFL.PanelSectionRow, null,
                SP_REACT.createElement("span", { style: { color: "#de5d5d", fontSize: 12 } }, startError)))));
    }
    // Connected
    return (SP_REACT.createElement(DFL.PanelSection, { title: "Epic Games" }, games.length === 0 ? (SP_REACT.createElement(DFL.PanelSectionRow, null,
        SP_REACT.createElement("span", { style: { color: "#95a7ba", fontSize: 13 } }, "No Epic games found in Heroic."))) : (games.map((game) => (SP_REACT.createElement(DFL.PanelSectionRow, { key: game.appName },
        SP_REACT.createElement(GameCard, { game: game, onAction: refresh })))))));
};
// ── Plugin export ─────────────────────────────────────────────────────────────
var index = definePlugin(() => ({
    name: "Heroic on Deck",
    titleView: (SP_REACT.createElement("div", { className: DFL.staticClasses.Title }, "Heroic on Deck")),
    content: SP_REACT.createElement(Content, null),
    icon: SP_REACT.createElement(GamepadIcon, null),
    onDismount() {
        // nothing to tear down; setInterval cleaned up by Content's useEffect
    },
}));

export { index as default };
