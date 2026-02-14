import React, { useState, useEffect } from 'react';
import type { CustomConnection } from '../../shared/types';

// Eye icon for showing password
const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

// Eye-off icon for hiding password
const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

interface AddConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionAdded: () => void;
  editConnectionId?: string; // Optional: if provided, we're editing
}

type AuthMethod = 'key' | 'password' | 'agent';

interface FormState {
  host: string;
  port: number;
  username: string;
  displayName: string;
  authMethod: AuthMethod;
  keyPath: string;
  password: string;
}

const initialFormState: FormState = {
  host: '',
  port: 22,
  username: '',
  displayName: '',
  authMethod: 'key',
  keyPath: '~/.ssh/id_rsa',
  password: '',
};

/**
 * Modal form for adding custom SSH connections.
 * Supports key, password, and SSH agent authentication.
 */
function AddConnectionModal({
  isOpen,
  onClose,
  onConnectionAdded,
  editConnectionId,
}: AddConnectionModalProps): React.JSX.Element | null {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [savePassword, setSavePassword] = useState(true); // Default checked per CONTEXT.md
  const [hasStoredPassword, setHasStoredPassword] = useState(false);
  const [passwordModified, setPasswordModified] = useState(false);

  // Check for stored credential when editing
  useEffect(() => {
    if (editConnectionId) {
      window.electronAPI.hasCredential(editConnectionId).then(setHasStoredPassword);
    }
  }, [editConnectionId]);

  if (!isOpen) {
    return null;
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    // Clear password state when auth method changes away from password
    if (name === 'authMethod' && value !== 'password') {
      setForm((prev) => ({
        ...prev,
        authMethod: value as AuthMethod,
        password: '',
      }));
      setShowPassword(false);
      setSavePassword(true);
      setPasswordModified(false);
      setError(null);
      return;
    }

    // Track password modification for stored password placeholder behavior
    if (name === 'password' && hasStoredPassword && !passwordModified) {
      setPasswordModified(true);
    }

    setForm((prev) => ({
      ...prev,
      [name]: name === 'port' ? parseInt(value, 10) || 22 : value,
    }));
    setError(null);
  };

  const validateForm = (): boolean => {
    if (!form.host.trim()) {
      setError('Host is required');
      return false;
    }
    if (!form.username.trim()) {
      setError('Username is required');
      return false;
    }
    if (form.port < 1 || form.port > 65535) {
      setError('Port must be between 1 and 65535');
      return false;
    }
    if (form.authMethod === 'key' && !form.keyPath.trim()) {
      setError('Key path is required for key authentication');
      return false;
    }
    // Password is required unless there's a stored password that hasn't been cleared
    if (form.authMethod === 'password' && !form.password && !(hasStoredPassword && !passwordModified)) {
      setError('Password is required for password authentication');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const connection: Omit<CustomConnection, 'id'> = {
        name: form.displayName.trim() || `${form.username}@${form.host}`,
        host: form.host.trim(),
        port: form.port,
        username: form.username.trim(),
        displayName: form.displayName.trim() || undefined,
        authMethod: form.authMethod,
        keyPath: form.authMethod === 'key' ? form.keyPath.trim() : undefined,
      };

      // Only pass password for storage if savePassword is checked
      // The password is still used for the connection attempt, but not persisted
      const passwordToSave = form.authMethod === 'password' && savePassword ? form.password : undefined;
      const result = await window.electronAPI.addConnection(connection, passwordToSave);

      if (result.success) {
        setForm(initialFormState);
        onConnectionAdded();
        onClose();
      } else {
        setError(result.error || 'Failed to add connection');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add connection');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setForm(initialFormState);
    setError(null);
    setShowPassword(false);
    setSavePassword(true);
    setPasswordModified(false);
    setHasStoredPassword(false);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal">
        <div className="modal__header">
          <h2 className="modal__title">Add Connection</h2>
          <button className="modal__close" onClick={handleClose} data-tooltip="Close">
            &times;
          </button>
        </div>

        <form className="modal__form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="host" className="form-field__label">
              Host <span className="form-field__required">*</span>
            </label>
            <input
              type="text"
              id="host"
              name="host"
              className="form-field__input"
              value={form.host}
              onChange={handleInputChange}
              placeholder="example.com"
              autoFocus
            />
          </div>

          <div className="form-field">
            <label htmlFor="port" className="form-field__label">
              Port
            </label>
            <input
              type="number"
              id="port"
              name="port"
              className="form-field__input"
              value={form.port}
              onChange={handleInputChange}
              min={1}
              max={65535}
            />
          </div>

          <div className="form-field">
            <label htmlFor="username" className="form-field__label">
              Username <span className="form-field__required">*</span>
            </label>
            <input
              type="text"
              id="username"
              name="username"
              className="form-field__input"
              value={form.username}
              onChange={handleInputChange}
              placeholder="root"
            />
          </div>

          <div className="form-field">
            <label htmlFor="displayName" className="form-field__label">
              Display Name
            </label>
            <input
              type="text"
              id="displayName"
              name="displayName"
              className="form-field__input"
              value={form.displayName}
              onChange={handleInputChange}
              placeholder="My Server (optional)"
            />
          </div>

          <div className="form-field">
            <label htmlFor="authMethod" className="form-field__label">
              Authentication Method
            </label>
            <select
              id="authMethod"
              name="authMethod"
              className="form-field__select"
              value={form.authMethod}
              onChange={handleInputChange}
            >
              <option value="key">SSH Key</option>
              <option value="password">Password</option>
              <option value="agent">SSH Agent</option>
            </select>
          </div>

          {form.authMethod === 'key' && (
            <div className="form-field">
              <label htmlFor="keyPath" className="form-field__label">
                Key Path <span className="form-field__required">*</span>
              </label>
              <input
                type="text"
                id="keyPath"
                name="keyPath"
                className="form-field__input"
                value={form.keyPath}
                onChange={handleInputChange}
                placeholder="~/.ssh/id_rsa"
              />
              <span className="form-field__hint">
                Common locations: ~/.ssh/id_rsa, ~/.ssh/id_ed25519
              </span>
            </div>
          )}

          {form.authMethod === 'password' && (
            <div className="form-field">
              <label htmlFor="password" className="form-field__label">
                Password <span className="form-field__required">*</span>
              </label>
              <div className="form-field__input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  className="form-field__input"
                  value={form.password}
                  onChange={handleInputChange}
                  placeholder={hasStoredPassword && !passwordModified ? '********' : undefined}
                />
                <button
                  type="button"
                  className="form-field__password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <div className="form-field__checkbox-row">
                <input
                  type="checkbox"
                  id="savePassword"
                  checked={savePassword}
                  onChange={(e) => setSavePassword(e.target.checked)}
                />
                <label htmlFor="savePassword">Save password securely</label>
                {hasStoredPassword && editConnectionId && (
                  <button
                    type="button"
                    className="form-field__clear-btn"
                    onClick={async () => {
                      await window.electronAPI.clearCredential(editConnectionId);
                      setHasStoredPassword(false);
                    }}
                  >
                    Clear saved password
                  </button>
                )}
              </div>
            </div>
          )}

          {error && <div className="form-error">{error}</div>}

          <div className="modal__actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Adding...' : 'Add Connection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddConnectionModal;
