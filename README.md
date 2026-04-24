# Heroic Decky Bridge Plugin

This Decky plugin talks to a local Heroic bridge server that runs inside the Heroic backend process.

## Supported Features

- List Heroic Epic games with box art
- Show install/download status
- Show download progress for active downloads
- Queue install/download for a game
- Remove a downloaded game
- Add a game to Steam as a non-Steam shortcut

## How It Connects

When Heroic starts, it creates an authenticated localhost bridge and writes connection data to:

- ~/.config/heroic/decky-bridge.json (native installs)
- ~/.var/app/com.heroicgameslauncher.hgl/config/heroic/decky-bridge.json (Flatpak)

The Decky backend reads this file, then sends authenticated requests to Heroic.

## Deploy

Copy this plugin folder to the Decky plugin directory, then restart Decky or use hot-reload.
