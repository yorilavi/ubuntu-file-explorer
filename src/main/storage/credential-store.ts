// Secure credential storage using Electron safeStorage
// Stores passwords and passphrases encrypted via macOS Keychain

import { safeStorage, app } from 'electron';
import { Conf } from 'electron-conf/main';

/**
 * Schema for credential storage.
 * Stores base64-encoded encrypted strings keyed by connection ID.
 */
interface CredentialStoreSchema {
  credentials: Record<string, string>;
}

// Initialize Conf for storing encrypted credentials
const credentialConf = new Conf<CredentialStoreSchema>({
  defaults: {
    credentials: {},
  },
  // Use a separate file for credentials
  name: 'credentials',
});

/**
 * Check if the app is ready for safeStorage operations.
 * safeStorage only works after app.whenReady().
 */
function ensureReady(): void {
  if (!app.isReady()) {
    throw new Error(
      '[credential-store] Cannot access secure storage before app is ready. ' +
      'Ensure app.whenReady() has resolved before using credential store.'
    );
  }
}

/**
 * Check if encryption is available on this system.
 * On macOS this means Keychain access is available.
 *
 * @returns true if encryption is available
 */
export function isEncryptionAvailable(): boolean {
  ensureReady();
  return safeStorage.isEncryptionAvailable();
}

/**
 * Save a credential (password or passphrase) for a connection.
 * The credential is encrypted using Electron's safeStorage API
 * which uses the macOS Keychain.
 *
 * @param connectionId - The ID of the connection this credential belongs to
 * @param credential - The password or passphrase to store
 * @throws Error if encryption is not available or app is not ready
 */
export function saveCredential(connectionId: string, credential: string): void {
  ensureReady();

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      '[credential-store] Encryption not available. Cannot securely store credentials.'
    );
  }

  // Encrypt the credential
  const encrypted = safeStorage.encryptString(credential);

  // Store as base64 string
  const base64 = encrypted.toString('base64');
  credentialConf.set(`credentials.${connectionId}`, base64);

  console.log(`[credential-store] Saved credential for connection: ${connectionId}`);
}

/**
 * Retrieve a credential for a connection.
 *
 * @param connectionId - The ID of the connection
 * @returns The decrypted credential, or undefined if not found
 * @throws Error if encryption is not available or app is not ready
 */
export function getCredential(connectionId: string): string | undefined {
  ensureReady();

  const base64 = credentialConf.get(`credentials.${connectionId}`) as string | undefined;

  if (!base64) {
    return undefined;
  }

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      '[credential-store] Encryption not available. Cannot decrypt credentials.'
    );
  }

  // Decode from base64 and decrypt
  const encrypted = Buffer.from(base64, 'base64');
  return safeStorage.decryptString(encrypted);
}

/**
 * Delete a credential for a connection.
 *
 * @param connectionId - The ID of the connection
 * @returns true if deleted, false if not found
 */
export function deleteCredential(connectionId: string): boolean {
  ensureReady();

  const existing = credentialConf.get(`credentials.${connectionId}`);

  if (!existing) {
    return false;
  }

  // Get all credentials and remove the one with the given ID
  const credentials = credentialConf.get('credentials') ?? {};
  delete credentials[connectionId];
  credentialConf.set('credentials', credentials);

  console.log(`[credential-store] Deleted credential for connection: ${connectionId}`);
  return true;
}

/**
 * Check if a credential exists for a connection.
 *
 * @param connectionId - The ID of the connection
 * @returns true if a credential exists
 */
export function hasCredential(connectionId: string): boolean {
  ensureReady();
  return credentialConf.has(`credentials.${connectionId}`);
}
