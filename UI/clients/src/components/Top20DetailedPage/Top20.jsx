import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TrendingUp, TrendingDown, Wallet, Play, Pause, RefreshCw } from 'lucide-react'
import useWebSocket from '@/hooks/useWebSocket'

const Top20 = () => {
  const [opportunities, setOpportunities] = useState([])
  const [balance, setBalance] = useState({ amount: 0, exchange: 'N/A' })
  const [isTrading, setIsTrading] = useState(false)
  
  // Conectar al WebSocket de V2
  const { isConnected, lastMessage, connectionError } = useWebSocket('ws://localhost:3031/api/spot/ui')

  // Datos simulados para demostración
  useEffect(() => {
    const mockData = [
      {
        symbol: 'BTC/USDT',
        minBuy: { price: 43250.50, exchange: 'Binance' },
        maxSell: { price: 43380.25, exchange: 'OKX' },
        percentage: 0.30,
        maker: 0.1,
        taker: 0.1
      },
      {
        symbol: 'ETH/USDT',
        minBuy: { price: 2650.75, exchange: 'KuCoin' },
        maxSell: { price: 2665.20, exchange: 'Binance' },
        percentage: 0.55,
        maker: 0.1,
        taker: 0.1
      },
      {
        symbol: 'ADA/USDT',
        minBuy: { price: 0.4525, exchange: 'Binance' },
        maxSell: { price: 0.4548, exchange: 'Bybit' },
        percentage: 0.51,
        maker: 0.1,
        taker: 0.1
      },
      {
        symbol: 'SOL/USDT',
        minBuy: { price: 98.45, exchange: 'OKX' },
        maxSell: { price: 99.12, exchange: 'KuCoin' },
        percentage: 0.68,
        maker: 0.1,
        taker: 0.1
      },
      {
        symbol: 'DOT/USDT',
        minBuy: { price: 7.235, exchange: 'Bybit' },
        maxSell: { price: 7.278, exchange: 'Binance' },
        percentage: 0.59,
        maker: 0.1,
        taker: 0.1
      }
    ]
    setOpportunities(mockData)
    setBalance({ amount: 1250.75, exchange: 'Binance' })
  }, [])

  // Procesar mensajes del WebSocket
  useEffect(() => {
    if (lastMessage) {
      console.log('Mensaje recibido en Top20:', lastMessage)
      
      if (lastMessage.type === 'spot-arb-data') {
        // Actualizar oportunidades con datos reales
        const newOpportunity = {
          symbol: lastMessage.payload.symbol,
          minBuy: { 
            price: lastMessage.payload.price_at_exMin_to_buy_asset,
            exchange: lastMessage.payload.exchange_min_name
          },
          maxSell: { 
            price: lastMessage.payload.price_at_exMax_to_sell_asset,
            exchange: lastMessage.payload.exchange_max_name
          },
          percentage: parseFloat(lastMessage.payload.percentage_difference?.replace('%', '') || 0),
          maker: lastMessage.payload.fees_exMin?.maker_fee || 0.1,
          taker: lastMessage.payload.fees_exMin?.taker_fee || 0.1
        }
        
        setOpportunities(prev => {
          const filtered = prev.filter(opp => opp.symbol !== newOpportunity.symbol)
          return [newOpportunity, ...filtered].slice(0, 20)
        })
      }
      
      if (lastMessage.type === 'full_balance_update_from_v2') {
        // Actualizar balance
        const balanceData = lastMessage.payload
        if (balanceData && balanceData.length > 0) {
          const mainBalance = balanceData[0]
          setBalance({
            amount: mainBalance.balance_usdt || 0,
            exchange: mainBalance.id_exchange || 'N/A'
          })
        }
      }
    }
  }, [lastMessage])

  const handleStartTrade = () => {
    setIsTrading(!isTrading)
  }

  const getPercentageColor = (percentage) => {
    if (percentage >= 0.5) return 'text-green-600'
    if (percentage >= 0.3) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(price)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Top 20 Oportunidades</h1>
          <p className="text-muted-foreground">Mejores oportunidades de arbitraje en tiempo real</p>
        </div>
        
        {/* Balance y Control */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <Wallet className="w-5 h-5 text-primary" />
              <div>
                <div className="text-sm text-muted-foreground">Balance</div>
                <div className="font-bold text-lg">{formatPrice(balance.amount)}</div>
                <div className="text-xs text-muted-foreground">{balance.exchange}</div>
              </div>
            </div>
          </Card>
          
          <Button
            onClick={handleStartTrade}
            size="lg"
            className={`flex items-center space-x-2 ${
              isTrading ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isTrading ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isTrading ? 'Pausar Trading' : 'Iniciar Trading'}</span>
          </Button>
        </div>
      </div>

      {/* Estado de conexión */}
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm text-muted-foreground">
          {isConnected ? 'Conectado al servidor' : 'Desconectado del servidor'}
        </span>
        {connectionError && (
          <Badge variant="destructive" className="text-xs">
            {connectionError}
          </Badge>
        )}
      </div>

      {/* Tabla de oportunidades */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>Oportunidades de Arbitraje</span>
            <Badge variant="secondary">{opportunities.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Símbolo</TableHead>
                  <TableHead>Compra (Min)</TableHead>
                  <TableHead>Venta (Max)</TableHead>
                  <TableHead>Porcentaje</TableHead>
                  <TableHead>Maker</TableHead>
                  <TableHead>Taker</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opportunities.map((opp, index) => (
                  <TableRow key={`${opp.symbol}-${index}`} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{opp.symbol}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{formatPrice(opp.minBuy.price)}</div>
                        <div className="text-xs text-muted-foreground">{opp.minBuy.exchange}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{formatPrice(opp.maxSell.price)}</div>
                        <div className="text-xs text-muted-foreground">{opp.maxSell.exchange}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={`flex items-center space-x-1 ${getPercentageColor(opp.percentage)}`}>
                        {opp.percentage >= 0 ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        <span className="font-medium">{opp.percentage.toFixed(2)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{(opp.maker * 100).toFixed(1)}%</TableCell>
                    <TableCell>{(opp.taker * 100).toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {opportunities.length === 0 && (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No hay oportunidades disponibles</p>
              <p className="text-sm text-muted-foreground">Esperando datos del servidor...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default Top20

