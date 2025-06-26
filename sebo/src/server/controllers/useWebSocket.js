import { useState, useEffect, useRef, useCallback } from 'react'

const useWebSocket = (url) => {
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState(null)
  const [connectionError, setConnectionError] = useState(null)
  const reconnectTimeoutRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5

  const connect = useCallback(() => {
    try {
      console.log('Intentando conectar a WebSocket:', url)
      const ws = new WebSocket(url)

      ws.onopen = () => {
        console.log('WebSocket conectado')
        setIsConnected(true)
        setConnectionError(null)
        reconnectAttemptsRef.current = 0
        setSocket(ws)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('Mensaje recibido:', data)
          setLastMessage(data)
        } catch (error) {
          console.error('Error al parsear mensaje WebSocket:', error)
        }
      }

      ws.onclose = (event) => {
        console.log('WebSocket desconectado:', event.code, event.reason)
        setIsConnected(false)
        setSocket(null)

        // Intentar reconectar solo si no fue un cierre intencional
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const timeout = Math.pow(2, reconnectAttemptsRef.current) * 1000 // Backoff exponencial
          console.log(`Reintentando conexión en ${timeout}ms (intento ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++
            connect()
          }, timeout)
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setConnectionError('Máximo número de intentos de reconexión alcanzado')
        }
      }

      ws.onerror = (error) => {
        console.error('Error en WebSocket:', error)
        setConnectionError('Error de conexión WebSocket')
      }

      return ws
    } catch (error) {
      console.error('Error al crear WebSocket:', error)
      setConnectionError('Error al crear conexión WebSocket')
      return null
    }
  }, [url])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    if (socket) {
      socket.close(1000, 'Desconexión intencional')
    }
  }, [socket])

  const sendMessage = useCallback((message) => {
    if (socket && isConnected) {
      try {
        const messageString = typeof message === 'string' ? message : JSON.stringify(message)
        socket.send(messageString)
        return true
      } catch (error) {
        console.error('Error al enviar mensaje:', error)
        return false
      }
    }
    return false
  }, [socket, isConnected])

  useEffect(() => {
    if (url) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [url, connect, disconnect])

  return {
    socket,
    isConnected,
    lastMessage,
    connectionError,
    sendMessage,
    reconnect: connect,
    disconnect
  }
}

export default useWebSocket

