// SSH config file parser
// Parses ~/.ssh/config into Server objects using the ssh-config library

import SSHConfig, { LineType } from 'ssh-config';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { Server } from './types';

/**
 * Slugify a host name for use as an ID.
 * Converts to lowercase, replaces spaces and special chars with hyphens.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Look up a computed SSH config parameter case-insensitively.
 *
 * SSH config keywords are case-insensitive (e.g. `identityFile` and
 * `IdentityFile` are equivalent), but the ssh-config library keys the
 * computed object by the parameter name exactly as written in the file.
 * This matches the keyword regardless of the casing the user used.
 */
function getParam(
  computed: Record<string, string | string[] | undefined>,
  keyword: string
): string | string[] | undefined {
  const target = keyword.toLowerCase();
  for (const key of Object.keys(computed)) {
    if (key.toLowerCase() === target) {
      return computed[key];
    }
  }
  return undefined;
}

/**
 * Parse raw SSH config content into Server objects.
 *
 * Uses ssh-config library which handles:
 * - First-match semantics (via compute())
 * - Wildcard patterns
 * - Include directives
 * - Match blocks
 *
 * @param configContent - Raw content of ~/.ssh/config file
 * @returns Array of Server objects
 */
export function parseSSHConfig(configContent: string): Server[] {
  const config = SSHConfig.parse(configContent);
  const servers: Server[] = [];

  // Iterate through config entries, looking for Host entries
  for (const entry of config) {
    // Skip non-directive entries (comments, empty lines)
    if (entry.type !== LineType.DIRECTIVE) {
      continue;
    }

    // Skip non-Host directives or wildcard '*'
    if (entry.param !== 'Host' || entry.value === '*') {
      continue;
    }

    const hostAlias = entry.value as string;

    // Use compute() to get merged settings (handles first-match semantics)
    const computed = config.compute(hostAlias) as Record<
      string,
      string | string[] | undefined
    >;

    // Determine auth method based on available config
    let authMethod: 'key' | 'password' | 'agent' = 'agent';
    let keyPath: string | undefined;

    // Check for IdentityFile (case-insensitive: identityFile == IdentityFile)
    const identityFile = getParam(computed, 'IdentityFile');
    if (identityFile) {
      // IdentityFile can be a string or array; use first one
      keyPath = Array.isArray(identityFile) ? identityFile[0] : identityFile;

      // Trim stray surrounding whitespace (e.g. a trailing space after the path)
      keyPath = keyPath.trim();

      // Strip surrounding quotes if present (SSH config allows quoted paths for spaces)
      if ((keyPath.startsWith('"') && keyPath.endsWith('"')) ||
          (keyPath.startsWith("'") && keyPath.endsWith("'"))) {
        keyPath = keyPath.slice(1, -1);
      }

      // Unescape backslash-escaped spaces (SSH config uses "\ " for spaces in paths)
      keyPath = keyPath.replace(/\\ /g, ' ');

      // Expand ~ to home directory if present
      if (keyPath.startsWith('~')) {
        keyPath = join(homedir(), keyPath.slice(1));
      }
      authMethod = 'key';
    }

    const hostName = getParam(computed, 'HostName');
    const port = getParam(computed, 'Port');
    const user = getParam(computed, 'User');

    const server: Server = {
      id: slugify(hostAlias),
      name: hostAlias,
      // HostName takes precedence, fallback to Host alias
      host: (typeof hostName === 'string' ? hostName : undefined) || hostAlias,
      port: typeof port === 'string' ? parseInt(port, 10) : 22,
      username: typeof user === 'string' ? user : '',
      source: 'ssh-config',
      keyPath,
      authMethod,
    };

    servers.push(server);
  }

  return servers;
}

/**
 * Read and parse the user's SSH config file.
 *
 * @returns Array of Server objects from ~/.ssh/config
 *          Returns empty array if file doesn't exist or on parse errors
 */
export function getSSHConfigServers(): Server[] {
  const configPath = join(homedir(), '.ssh', 'config');

  // Check if config file exists
  if (!existsSync(configPath)) {
    console.log('[config-parser] No SSH config file found at:', configPath);
    return [];
  }

  try {
    const configContent = readFileSync(configPath, 'utf-8');
    const servers = parseSSHConfig(configContent);
    console.log(`[config-parser] Parsed ${servers.length} servers from SSH config`);
    return servers;
  } catch (error) {
    console.warn('[config-parser] Error parsing SSH config:', error);
    return [];
  }
}
