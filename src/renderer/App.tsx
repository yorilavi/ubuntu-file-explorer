import React, { useState } from 'react';
import '../shared/types'; // Import for Window interface extension
import ServerSidebar from './components/ServerSidebar';

/**
 * Main application component with sidebar and content area.
 * Sidebar displays servers, content area will show directory listing (next plan).
 */
function App(): React.JSX.Element {
  const [selectedServer, setSelectedServer] = useState<string | null>(null);

  return (
    <div className="app-layout">
      <ServerSidebar
        selectedServerId={selectedServer}
        onServerSelect={setSelectedServer}
      />
      <main className="main-content">
        <div className="placeholder">
          {selectedServer
            ? `Selected: ${selectedServer}`
            : 'Select a server to browse'}
        </div>
      </main>
    </div>
  );
}

export default App;
