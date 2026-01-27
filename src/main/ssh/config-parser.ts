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
    const computed = config.compute(hostAlias);

    // Determine auth method based on available config
    let authMethod: 'key' | 'password' | 'agent' = 'agent';
    let keyPath: string | undefined;

    // Check for IdentityFile
    const identityFile = computed.IdentityFile;
    if (identityFile) {
      // IdentityFile can be a string or array; use first one
      keyPath = Array.isArray(identityFile) ? identityFile[0] : identityFile;
      // Expand ~ to home directory if present
      if (keyPath.startsWith('~')) {
        keyPath = join(homedir(), keyPath.slice(1));
      }
      authMethod = 'key';
    }

    const server: Server = {
      id: slugify(hostAlias),
      name: hostAlias,
      // HostName takes precedence, fallback to Host alias
      host: (computed.HostName as string) || hostAlias,
      port: computed.Port ? parseInt(computed.Port as string, 10) : 22,
      username: (computed.User as string) || '',
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
