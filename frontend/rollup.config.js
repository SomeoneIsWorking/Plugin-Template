import alias from "@rollup/plugin-alias";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import typescript from "@rollup/plugin-typescript";
import { defineConfig } from "rollup";
import externalGlobals from "rollup-plugin-external-globals";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const configDir = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(configDir, "src/manifest.ts");

export default defineConfig({
  input: "./src/index.tsx",
  plugins: [
    alias({
      entries: [
        {
          find: "@decky/manifest",
          replacement: manifestPath,
        },
      ],
    }),
    commonjs(),
    nodeResolve(),
    typescript(),
    externalGlobals({
      react: "SP_REACT",
      "react-dom": "SP_REACTDOM",
      "@decky/ui": "DFL",
    }),
    replace({
      preventAssignment: false,
      "process.env.NODE_ENV": JSON.stringify("production"),
    }),
    json(),
  ],
  // react, react-dom and @decky/ui are provided by Decky at runtime.
  // @decky/api must be bundled so it can initialize itself from Decky's secret internal API.
  external: ["react", "react-dom", "@decky/ui"],
  output: {
    file: "../dist/index.js",
    format: "es",
    exports: "default",
  },
});
