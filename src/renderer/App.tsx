import React, { useEffect, useState } from 'react';
import '../shared/types'; // Import for Window interface extension

function App(): React.JSX.Element {
  const [pingResult, setPingResult] = useState<string>('');
  const [appVersion, setAppVersion] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function testIPC() {
      try {
        // Test ping/pong
        const pong = await window.electronAPI.ping('hello from renderer');
        setPingResult(pong);

        // Get app version
        const version = await window.electronAPI.getAppVersion();
        setAppVersion(version);
      } catch (error) {
        console.error('IPC error:', error);
        setPingResult('Error: ' + String(error));
      } finally {
        setIsLoading(false);
      }
    }

    testIPC();
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      gap: '1rem'
    }}>
      <h1>Ubuntu File Explorer</h1>
      <p style={{ color: '#888' }}>Foundation & IPC Ready</p>

      <div style={{
        marginTop: '2rem',
        padding: '1.5rem',
        background: '#2a2a2a',
        borderRadius: '8px',
        minWidth: '300px'
      }}>
        <h3 style={{ marginBottom: '1rem', color: '#4ade80' }}>IPC Status</h3>

        {isLoading ? (
          <p>Testing IPC connection...</p>
        ) : (
          <>
            <p style={{ marginBottom: '0.5rem' }}>
              <strong>Ping result:</strong>{' '}
              <code style={{ color: '#60a5fa' }}>{pingResult}</code>
            </p>
            <p>
              <strong>App version:</strong>{' '}
              <code style={{ color: '#60a5fa' }}>{appVersion}</code>
            </p>
          </>
        )}
      </div>

      <p style={{ marginTop: '2rem', fontSize: '0.875rem', color: '#666' }}>
        Edit src/renderer/App.tsx to test HMR
      </p>
    </div>
  );
}

export default App;
