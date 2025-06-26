import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { Brain, Play, TestTube, Activity, TrendingUp, Database, Clock, Target } from 'lucide-react'

const Datos = () => {
  const [modelData, setModelData] = useState({
    exists: false,
    accuracy: 0,
    loss: 0,
    epochs_trained: 0,
    last_updated: null,
    training_history: []
  })
  
  const [trainingStatus, setTrainingStatus] = useState({
    is_training: false,
    current_epoch: 0,
    total_epochs: 0,
    current_loss: 0,
    current_accuracy: 0,
    start_time: null
  })
  
  const [testingStatus, setTestingStatus] = useState({
    is_testing: false,
    test_results: null,
    start_time: null
  })
  
  const [epochs, setEpochs] = useState(100)

  // Cargar datos del modelo al montar el componente
  useEffect(() => {
    fetchModelStatus()
  }, [])

  // Polling para actualizar el estado durante el entrenamiento
  useEffect(() => {
    let interval
    if (trainingStatus.is_training) {
      interval = setInterval(() => {
        fetchTrainingStatus()
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [trainingStatus.is_training])

  // Polling para actualizar el estado durante las pruebas
  useEffect(() => {
    let interval
    if (testingStatus.is_testing) {
      interval = setInterval(() => {
        fetchTestStatus()
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [testingStatus.is_testing])

  const fetchModelStatus = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/trading/model/status')
      if (response.ok) {
        const data = await response.json()
        setModelData(data)
      }
    } catch (error) {
      console.error('Error al obtener estado del modelo:', error)
    }
  }

  const fetchTrainingStatus = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/trading/model/training-status')
      if (response.ok) {
        const data = await response.json()
        setTrainingStatus(data)
        
        // Si el entrenamiento terminó, actualizar los datos del modelo
        if (!data.is_training && trainingStatus.is_training) {
          fetchModelStatus()
        }
      }
    } catch (error) {
      console.error('Error al obtener estado del entrenamiento:', error)
    }
  }

  const fetchTestStatus = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/trading/model/test-status')
      if (response.ok) {
        const data = await response.json()
        setTestingStatus(data)
      }
    } catch (error) {
      console.error('Error al obtener estado de las pruebas:', error)
    }
  }

  const handleStartTraining = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/trading/model/train', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ epochs: parseInt(epochs) })
      })
      
      if (response.ok) {
        setTrainingStatus(prev => ({ ...prev, is_training: true }))
      } else {
        const error = await response.json()
        alert(error.error || 'Error al iniciar entrenamiento')
      }
    } catch (error) {
      console.error('Error al iniciar entrenamiento:', error)
      alert('Error de conexión al iniciar entrenamiento')
    }
  }

  const handleStartTesting = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/trading/model/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (response.ok) {
        setTestingStatus(prev => ({ ...prev, is_testing: true }))
      } else {
        const error = await response.json()
        alert(error.error || 'Error al iniciar pruebas')
      }
    } catch (error) {
      console.error('Error al iniciar pruebas:', error)
      alert('Error de conexión al iniciar pruebas')
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString('es-ES')
  }

  const getTrainingProgress = () => {
    if (trainingStatus.total_epochs === 0) return 0
    return (trainingStatus.current_epoch / trainingStatus.total_epochs) * 100
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Datos del Modelo</h1>
        <p className="text-muted-foreground">Entrenamiento y análisis del modelo de IA</p>
      </div>

      {/* Estado del Modelo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Brain className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Estado del Modelo</p>
                <p className="text-2xl font-bold">
                  {modelData.exists ? (
                    <Badge variant="default" className="bg-green-600">Entrenado</Badge>
                  ) : (
                    <Badge variant="secondary">No Entrenado</Badge>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Precisión</p>
                <p className="text-2xl font-bold">{(modelData.accuracy * 100).toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Pérdida</p>
                <p className="text-2xl font-bold">{modelData.loss.toFixed(4)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Database className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Épocas</p>
                <p className="text-2xl font-bold">{modelData.epochs_trained}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controles de Entrenamiento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Play className="w-5 h-5" />
            <span>Entrenamiento del Modelo</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="epochs">Número de Épocas</Label>
              <Input
                id="epochs"
                type="number"
                value={epochs}
                onChange={(e) => setEpochs(e.target.value)}
                min="1"
                max="1000"
                disabled={trainingStatus.is_training}
              />
            </div>
            <Button
              onClick={handleStartTraining}
              disabled={trainingStatus.is_training}
              className="flex items-center space-x-2"
            >
              <Play className="w-4 h-4" />
              <span>{trainingStatus.is_training ? 'Entrenando...' : 'Iniciar Entrenamiento'}</span>
            </Button>
          </div>

          {trainingStatus.is_training && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progreso: {trainingStatus.current_epoch} / {trainingStatus.total_epochs}</span>
                <span>{getTrainingProgress().toFixed(1)}%</span>
              </div>
              <Progress value={getTrainingProgress()} className="w-full" />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Pérdida Actual: </span>
                  <span className="font-medium">{trainingStatus.current_loss.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Precisión Actual: </span>
                  <span className="font-medium">{(trainingStatus.current_accuracy * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráficas de Entrenamiento */}
      {modelData.training_history && modelData.training_history.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Precisión</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={modelData.training_history}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="epoch" />
                  <YAxis domain={[0, 1]} />
                  <Tooltip formatter={(value) => [`${(value * 100).toFixed(2)}%`, 'Precisión']} />
                  <Line 
                    type="monotone" 
                    dataKey="accuracy" 
                    stroke="#22c55e" 
                    strokeWidth={2}
                    dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historial de Pérdida</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={modelData.training_history}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="epoch" />
                  <YAxis />
                  <Tooltip formatter={(value) => [value.toFixed(4), 'Pérdida']} />
                  <Line 
                    type="monotone" 
                    dataKey="loss" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pruebas del Modelo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TestTube className="w-5 h-5" />
            <span>Pruebas del Modelo</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleStartTesting}
            disabled={!modelData.exists || testingStatus.is_testing}
            className="flex items-center space-x-2"
          >
            <TestTube className="w-4 h-4" />
            <span>{testingStatus.is_testing ? 'Ejecutando Pruebas...' : 'Iniciar Pruebas'}</span>
          </Button>

          {testingStatus.is_testing && (
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 animate-pulse" />
              <span className="text-sm text-muted-foreground">Ejecutando pruebas del modelo...</span>
            </div>
          )}

          {testingStatus.test_results && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {(testingStatus.test_results.accuracy * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Precisión</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {(testingStatus.test_results.precision * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Precisión</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {(testingStatus.test_results.recall * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Recall</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {(testingStatus.test_results.f1_score * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">F1-Score</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Información Adicional */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>Información del Sistema</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Última Actualización: </span>
              <span className="font-medium">{formatDate(modelData.last_updated)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Estado del Entrenamiento: </span>
              <Badge variant={trainingStatus.is_training ? "default" : "secondary"}>
                {trainingStatus.is_training ? "En Progreso" : "Inactivo"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Datos

