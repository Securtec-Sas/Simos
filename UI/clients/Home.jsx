import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, BarChart3, Activity, Zap, Shield, Target } from 'lucide-react'

const Home = () => {
  const features = [
    {
      icon: TrendingUp,
      title: 'Top 20 Oportunidades',
      description: 'Monitorea las mejores oportunidades de arbitraje en tiempo real con datos actualizados de múltiples exchanges.',
      link: '/top20',
      color: 'text-green-600'
    },
    {
      icon: BarChart3,
      title: 'Datos y Modelo IA',
      description: 'Entrena y prueba modelos de inteligencia artificial para optimizar las estrategias de trading.',
      link: '/datos',
      color: 'text-blue-600'
    }
  ]

  const stats = [
    {
      icon: Activity,
      label: 'Tiempo Real',
      value: 'WebSocket',
      description: 'Conexión en vivo'
    },
    {
      icon: Zap,
      label: 'Velocidad',
      value: '<100ms',
      description: 'Latencia promedio'
    },
    {
      icon: Shield,
      label: 'Seguridad',
      value: '99.9%',
      description: 'Disponibilidad'
    },
    {
      icon: Target,
      label: 'Precisión',
      value: '95%+',
      description: 'Modelo IA'
    }
  ]

  return (
    <div className="container mx-auto p-6">
      {/* Hero Section */}
      <div className="text-center py-12 space-y-6">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground">
            Simos Trading
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Plataforma avanzada de arbitraje de criptomonedas con inteligencia artificial 
            para maximizar oportunidades de trading en tiempo real.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/top20">
            <Button size="lg" className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5" />
              <span>Ver Oportunidades</span>
            </Button>
          </Link>
          <Link to="/datos">
            <Button size="lg" variant="outline" className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5" />
              <span>Datos del Modelo</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index} className="text-center">
              <CardContent className="p-6">
                <Icon className="w-8 h-8 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="text-sm font-medium text-foreground">{stat.label}</div>
                <div className="text-xs text-muted-foreground">{stat.description}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Features Section */}
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Funcionalidades Principales</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Herramientas profesionales para trading automatizado y análisis de mercado
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-3">
                    <Icon className={`w-6 h-6 ${feature.color}`} />
                    <span>{feature.title}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">{feature.description}</p>
                  <Link to={feature.link}>
                    <Button className="w-full">
                      Acceder
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Technical Info */}
      <div className="mt-16 p-8 bg-muted rounded-lg">
        <div className="text-center space-y-4">
          <h3 className="text-2xl font-bold text-foreground">Arquitectura Técnica</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-medium text-foreground">Backend V2</div>
              <div className="text-muted-foreground">Puerto 3001 - Recepción de datos</div>
            </div>
            <div>
              <div className="font-medium text-foreground">WebSocket UI</div>
              <div className="text-muted-foreground">Puerto 3031 - Transmisión a interfaz</div>
            </div>
            <div>
              <div className="font-medium text-foreground">API Flask</div>
              <div className="text-muted-foreground">Puerto 5000 - Servicios del modelo</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home

