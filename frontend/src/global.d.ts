// Decky provides React as the global SP_REACT at runtime.
// Rollup maps `import ... from "react"` to the SP_REACT global.
// This declaration lets TypeScript understand the jsxFactory setting.
import type * as React from 'react';
declare const SP_REACT: typeof React;
