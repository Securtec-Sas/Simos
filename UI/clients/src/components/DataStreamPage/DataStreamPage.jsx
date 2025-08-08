import React, { useEffect, useState } from 'react';

const WS_URL = 'ws://localhost:3001/api/spot/ui';

const DataStreamPage = () => {
  const [messages, setMessages] = useState([]);
  const [wsStarted, setWsStarted] = useState(false);

  useEffect(() => {
    let ws;

    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setWsStarted(true);
    };

    ws.onmessage = (event) => {
      setMessages(prev => [event.data, ...prev].slice(0, 50));
    };

    ws.onerror = (err) => {
      setMessages(prev => [`[ERROR] ${err.message}`, ...prev]);
    };

    ws.onclose = () => {
      setMessages(prev => ['[CONECCIÓN CERRADA]', ...prev]);
    };

    return () => {
      if (ws) ws.close();
    };
  }, []);

  


  

  return (
    <div style={{ padding: 20 }}>
      <h2>Datos en tiempo real (WebSocket)</h2>
      {!wsStarted && <div>Iniciando transmisión...</div>}
      <div style={{ maxHeight: 400, overflowY: 'auto', background: '#f5f5f5', padding: 10 }}>
        {messages.length === 0 && <div>No hay datos aún.</div>}
        {messages.map((msg, idx) => (
          <pre key={idx} style={{ margin: 0, fontSize: 12 }}>{msg}</pre>
        ))}
      </div>
    </div>
  );
};

export default DataStreamPage;