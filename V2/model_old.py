# model.py

import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error
import joblib

class ArbitrageModel:
    def __init__(self):
        self.model = None
        self.data = []

    def add_data(self, new_data):
        self.data.extend(new_data)

    def prepare_data(self):
        # Convertir los datos a un DataFrame de pandas
        # self.data es una lista de diccionarios, ej:
        # [{'symbol': 'BTC/USDT', ..., 'valores': {'valMin': 113.2, 'valMax': 114.86, 'difer': '1.47%'}}]
        if not self.data:
            raise ValueError("No hay datos para preparar (self.data está vacío).")
        
        initial_df = pd.DataFrame(self.data)
        
        # Aquí deberías preprocesar tus datos para el modelo de IA.
        # Por ejemplo, si 'difer' es una cadena como '5%', necesitarías convertirla a un número.
        # Y si 'exchanges' es una lista, podrías necesitar one-hot encoding o similar.
        print("Datos originales (primeros 5 elementos si hay muchos):")
        print(self.data[:5]) # Imprimir solo una muestra si self.data es muy grande

        if initial_df.empty:
            raise ValueError("No hay datos para preparar (DataFrame inicial vacío después de pd.DataFrame(self.data)).")

        # La información relevante ('valMin', 'valMax', 'difer') está anidada en la columna 'valores'.
        # Cada elemento de la columna 'valores' es un diccionario.
        if 'valores' not in initial_df.columns:
            raise ValueError("La columna 'valores' no se encuentra en los datos. "
                             "La estructura esperada es [{'symbol': ..., 'valores': {'valMin': ..., 'valMax': ..., 'difer': ...}}]")

        # Expandir la columna 'valores' en columnas separadas.
        # df_processed contendrá columnas como 'valMin', 'valMax', 'difer' directamente.
        df_processed = initial_df['valores'].apply(pd.Series)

        # Verificar que las columnas necesarias existan después de la expansión
        required_value_cols = ['valMin', 'valMax', 'difer']
        for col in required_value_cols:
            if col not in df_processed.columns:
                raise ValueError(f"La clave '{col}' no se encontró dentro de los diccionarios de la columna 'valores'. "
                                 f"Columnas disponibles después de expandir 'valores': {df_processed.columns.tolist()}")

        # Ejemplo básico: si 'difer' es el target y las otras columnas son features
        # Esto es un placeholder, la preparación real dependerá de tu modelo y datos.
        
        # Convertir 'difer' de cadena (ej. '1.47%') a numérico (ej. 0.0147)
        df_processed['difer_numeric'] = df_processed['difer'].astype(str).str.replace('%', '').astype(float) / 100
        
        # Seleccionar características y objetivo
        features = ['valMin', 'valMax'] # Estas características ahora existen en df_processed
        target = 'difer_numeric'

        # Asegurarse de que las características sean numéricas
        for feature in features:
            if not pd.api.types.is_numeric_dtype(df_processed[feature]):
                try:
                    df_processed[feature] = pd.to_numeric(df_processed[feature])
                except ValueError as e:
                    raise ValueError(
                        f"No se pudo convertir la característica '{feature}' a numérica: {e}. "
                        f"Verifique los datos en 'valores'."
                    )
        
        X = df_processed[features]
        y = df_processed[target]
        
        return X, y

    def train_model(self):
        X, y = self.prepare_data()
        
        # Dividir los datos en conjuntos de entrenamiento y prueba
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Inicializar y entrenar el modelo (ejemplo con Regresión Lineal)
        self.model = LinearRegression()
        self.model.fit(X_train, y_train)
        
        # Evaluar el modelo
        predictions = self.model.predict(X_test)
        mse = mean_squared_error(y_test, predictions)
        print(f"Mean Squared Error: {mse}")
        
        # Guardar el modelo entrenado
        joblib.dump(self.model, 'arbitrage_model.pkl')
        print("Modelo entrenado y guardado como 'arbitrage_model.pkl'")

    def load_model(self, model_path='arbitrage_model.pkl'):
        self.model = joblib.load(model_path)
        print(f"Modelo cargado desde '{model_path}'")

    def predict(self, data_point):
        if self.model is None:
            raise ValueError("El modelo no ha sido entrenado o cargado.")
        
        # Preprocesar el punto de datos para la predicción
        # Asegúrate de que 'data_point' tenga las mismas características que las usadas para entrenar
        df_point = pd.DataFrame([data_point])
        features = ['valMin', 'valMax'] # Deben coincidir con las características de entrenamiento
        X_point = df_point[features]
        
        prediction = self.model.predict(X_point)
        return prediction[0]

# Función para generar datos de entrenamiento de ejemplo
def generate_sample_data(num_samples=100):
    sample_data = []
    for i in range(num_samples):
        val_min = round(100 + i * 0.1 + (i % 10) * 0.5, 2) # Simular variación
        val_max = round(val_min * (1 + (0.005 + i * 0.0001)), 2) # valMax siempre mayor que valMin
        difer_val = round(((val_max - val_min) / val_min) * 100, 2)
        
        sample_data.append({
            "symbol": f"BTC/USDT",
            "name": f"Bitcoin",
            "exchanges": ["Binance", "OKX"],
            "valores": {
                "exValMin": "Binance",
                "exValMax": "OKX",
                "valMin": val_min,
                "valMax": val_max,
                "difer": f"{difer_val}%"
            }
        })
    return sample_data

# Ejemplo de uso:
if __name__ == "__main__":
    # Generar datos de ejemplo
    training_data = generate_sample_data(200)
    
    # Inicializar el modelo
    model = ArbitrageModel()
    
    # Añadir datos al modelo
    model.add_data(training_data)
    
    # Entrenar el modelo
    model.train_model()
    
    # Cargar el modelo (si ya está entrenado y guardado)
    # model.load_model()
    
    # Ejemplo de predicción
    sample_prediction_data = {
        "symbol": "ETH/USDT",
        "name": "Ethereum",
        "exchanges": ["Binance", "Kraken"],
        "valores": {
            "exValMin": "Binance",
            "exValMax": "Kraken",
            "valMin": 2000,
            "valMax": 2015,
            "difer": "0.75%"
        }
    }
    
    # Para la predicción, necesitamos los valores numéricos de valMin y valMax
    # El modelo espera un diccionario con las claves 'valMin' y 'valMax' directamente
    # o un DataFrame con esas columnas.
    # Aquí, adaptamos el sample_prediction_data para que coincida con lo que espera el método predict.
    prediction_input = {
        'valMin': sample_prediction_data['valores']['valMin'],
        'valMax': sample_prediction_data['valores']['valMax']
    }
    
    predicted_difer = model.predict(prediction_input)
    print(f"Diferencia porcentual predicha: {predicted_difer*100:.2f}%")
