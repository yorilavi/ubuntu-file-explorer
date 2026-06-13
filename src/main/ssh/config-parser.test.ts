import { describe, it, expect } from 'vitest';
import { homedir } from 'os';
import { join } from 'path';
import { parseSSHConfig } from './config-parser';

describe('parseSSHConfig', () => {
  it('detects key auth from a lowercase identityFile (case-insensitive keyword)', () => {
    // Regression: SSH treats config keywords case-insensitively, so a
    // lowercase `identityFile` must still be recognized as key auth.
    const [server] = parseSSHConfig(
      [
        'Host staging',
        '  HostName 3.144.206.125',
        '  User ubuntu',
        '  identityFile /Users/yori/.ssh/staging.pem',
      ].join('\n')
    );

    expect(server.authMethod).toBe('key');
    expect(server.keyPath).toBe('/Users/yori/.ssh/staging.pem');
  });

  it('detects key auth from a capitalized IdentityFile', () => {
    const [server] = parseSSHConfig(
      ['Host prod', '  HostName 3.136.112.35', '  User ubuntu', '  IdentityFile /Users/yori/.ssh/prod.pem'].join('\n')
    );

    expect(server.authMethod).toBe('key');
    expect(server.keyPath).toBe('/Users/yori/.ssh/prod.pem');
  });

  it('falls back to agent auth when no identity file is present', () => {
    const [server] = parseSSHConfig(['Host bare', '  HostName 10.0.0.1', '  User root'].join('\n'));

    expect(server.authMethod).toBe('agent');
    expect(server.keyPath).toBeUndefined();
  });

  it('trims a trailing space after the key path', () => {
    const [server] = parseSSHConfig(
      ['Host trailing', '  HostName 10.0.0.2', '  User ubuntu', '  IdentityFile /Users/yori/.ssh/key.pem '].join('\n')
    );

    expect(server.keyPath).toBe('/Users/yori/.ssh/key.pem');
  });

  it('expands a leading ~ in the key path to the home directory', () => {
    const [server] = parseSSHConfig(
      ['Host tilde', '  HostName 10.0.0.3', '  User ubuntu', '  IdentityFile ~/.ssh/id_ed25519'].join('\n')
    );

    expect(server.keyPath).toBe(join(homedir(), '/.ssh/id_ed25519'));
  });

  it('reads HostName, User, and Port regardless of keyword casing', () => {
    const [server] = parseSSHConfig(
      ['Host weird', '  hostname 192.168.1.5', '  user deploy', '  port 2222'].join('\n')
    );

    expect(server.host).toBe('192.168.1.5');
    expect(server.username).toBe('deploy');
    expect(server.port).toBe(2222);
  });

  it('skips the wildcard Host * entry', () => {
    const servers = parseSSHConfig(
      ['Host *', '  ServerAliveInterval 60', '', 'Host real', '  HostName 1.2.3.4', '  User me'].join('\n')
    );

    expect(servers).toHaveLength(1);
    expect(servers[0].name).toBe('real');
  });
});
