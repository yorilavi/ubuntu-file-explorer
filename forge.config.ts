import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, cpSync } from 'node:fs';
import { join } from 'node:path';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
  },
  rebuildConfig: {},
  hooks: {
    // After packaging on macOS, install the freshly built .app into
    // /Applications and re-register it with LaunchServices so Spotlight
    // always launches the latest build. Best-effort: never fails the build.
    postPackage: async (_forgeConfig, options) => {
      if (process.platform !== 'darwin') {
        return;
      }
      try {
        const outputPath = options.outputPaths[0];
        if (!outputPath || !existsSync(outputPath)) {
          return;
        }
        const appName = readdirSync(outputPath).find((f) => f.endsWith('.app'));
        if (!appName) {
          return;
        }
        const src = join(outputPath, appName);
        const dest = join('/Applications', appName);
        rmSync(dest, { recursive: true, force: true });
        cpSync(src, dest, { recursive: true });
        execFileSync(
          '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister',
          ['-f', dest]
        );
        console.log(`[postPackage] Installed ${appName} to /Applications (Spotlight will use this build)`);
      } catch (err) {
        console.warn('[postPackage] Could not install to /Applications:', err instanceof Error ? err.message : err);
      }
    },
  },
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
