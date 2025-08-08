import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, mean_absolute_error, mean_squared_error
import warnings

# Suppress specific warnings from scikit-learn about feature names
warnings.filterwarnings('ignore', category=UserWarning, module='sklearn')


class ArbitrageIntelligenceModel:
    def __init__(self, model_path=None, hyperparameters=None):
        self.model = None
        self.model_path = model_path
        self.hyperparameters = hyperparameters if hyperparameters else {"solver": "liblinear", "random_state": 42} # Example hyperparams
        self.preprocessor = None
        self.numeric_features = [
            'gross_percentage_diff_sebo', 'price_ex_min_buy_asset_sebo',
            'price_ex_max_sell_asset_sebo', 'ex_min_taker_fee_rate_sebo',
            'ex_max_taker_fee_rate_sebo', 'asset_withdrawal_fee_from_ex_min_sebo',
            'initial_usdt_withdrawal_selected_fee'
        ]
        self.categorical_features = ['ex_min_id_sebo', 'ex_max_id_sebo', 'symbol_name']
        self.model_trained = False

        if model_path:
            try:
                self.load_model(model_path)
                print(f"Modelo y preprocesador cargados desde {model_path}")
            except FileNotFoundError:
                print(f"Advertencia: Modelo no encontrado en {model_path}. Se creará un nuevo modelo si se llama a train().")
                self._build_model() # Build model if not found
            except Exception as e:
                print(f"Error cargando el modelo desde {model_path}: {e}")
                self._build_model() # Build model on other load errors
        else:
            self._build_model()

    def _build_model(self):
        # Define transformations for numeric and categorical features
        numeric_transformer = StandardScaler()
        categorical_transformer = OneHotEncoder(handle_unknown='ignore', sparse_output=False)

        # Create a column transformer to apply different transformations to different columns
        self.preprocessor = ColumnTransformer(
            transformers=[
                ('num', numeric_transformer, self.numeric_features),
                ('cat', categorical_transformer, self.categorical_features)
            ],
            remainder='passthrough' # Keep other columns (if any)
        )

        # Create the pipeline with preprocessing and the model
        self.model = Pipeline(steps=[
            ('preprocessor', self.preprocessor),
            ('classifier', LogisticRegression(**self.hyperparameters))
        ])
        self.model_trained = False
        print("Modelo LogisticRegression con preprocesador construido.")

    def _prepare_data(self, X_raw):
        """Converts input data (expected to be list of dicts or DataFrame) to DataFrame."""
        if not isinstance(X_raw, pd.DataFrame):
            X_df = pd.DataFrame(X_raw)
        else:
            X_df = X_raw.copy()

        # Fill NaNs for numeric features with a placeholder (e.g., median or 0)
        # For simplicity, using 0 here. In a real scenario, this needs careful consideration.
        for col in self.numeric_features:
            if col in X_df.columns:
                X_df[col] = pd.to_numeric(X_df[col], errors='coerce').fillna(0)
            else:
                X_df[col] = 0 # Add column if missing, with default value

        # Fill NaNs for categorical features with a placeholder string
        for col in self.categorical_features:
            if col in X_df.columns:
                X_df[col] = X_df[col].astype(str).fillna('missing')
            else:
                X_df[col] = 'missing' # Add column if missing

        # Ensure all features are present
        all_features = self.numeric_features + self.categorical_features
        for col in all_features:
            if col not in X_df.columns:
                 # This case should be handled by the loops above, but as a safeguard:
                print(f"Advertencia: La característica '{col}' no estaba en los datos de entrada. Se añadió con valor por defecto.")
                if col in self.numeric_features: X_df[col] = 0
                else: X_df[col] = 'missing'

        return X_df[all_features] # Return DataFrame with correct column order


    def train(self, X_raw, y_raw, X_val_raw=None, y_val_raw=None, epochs=None, batch_size=None): # epochs/batch_size not used for LR
        print(f"Iniciando entrenamiento del modelo...")
        if not X_raw or not y_raw:
            print("Error: Datos de entrenamiento (X_raw o y_raw) no pueden estar vacíos.")
            return {"error": "Datos de entrenamiento vacíos"}

        X_train_df = self._prepare_data(X_raw)
        y_train = np.array(y_raw)

        if X_train_df.empty:
            print("Error: DataFrame de entrenamiento vacío después de la preparación.")
            return {"error": "DataFrame de entrenamiento vacío"}
        if len(X_train_df) != len(y_train):
            print(f"Error: Desajuste en la cantidad de muestras X_train ({len(X_train_df)}) y y_train ({len(y_train)}).")
            return {"error": "Desajuste en muestras X_train/y_train"}

        try:
            self.model.fit(X_train_df, y_train)
            self.model_trained = True
            print("Entrenamiento del modelo completado.")

            # Simulate history for consistency, though not directly applicable to Logistic Regression's fit method
            history = {
                'epochs': [1], # Logistic regression doesn't have epochs in the same way neural networks do
                'train_loss': [0], # Placeholder, sklearn's LogisticRegression doesn't return loss directly from fit
                'train_accuracy': [self.model.score(X_train_df, y_train)],
                'val_loss': [],
                'val_accuracy': []
            }
            if X_val_raw is not None and y_val_raw is not None:
                X_val_df = self._prepare_data(X_val_raw)
                y_val = np.array(y_val_raw)
                if not X_val_df.empty and len(X_val_df) == len(y_val):
                    history['val_accuracy'] = [self.model.score(X_val_df, y_val)]
            return history
        except Exception as e:
            print(f"Error durante el entrenamiento: {e}")
            self.model_trained = False
            return {"error": str(e)}


    def predict(self, X_raw):
        if not self.model_trained:
            print("Advertencia: El modelo no ha sido entrenado. Realizando predicciones con un modelo no entrenado (o inicial).")
            # For LogisticRegression, predict might still work with initial coefficients, but predictions will be meaningless.
            # Alternatively, return default predictions or raise an error.
            # For now, let it try, it might use default coefs or error out if not possible.

        if not X_raw:
            print("Error: Datos de entrada (X_raw) para predicción no pueden estar vacíos.")
            return None # Or an empty list/array based on expected output format

        X_df = self._prepare_data(X_raw)
        if X_df.empty:
            print("Error: DataFrame para predicción vacío después de la preparación.")
            return None

        try:
            predictions = self.model.predict(X_df)
            probabilities = self.model.predict_proba(X_df) # Get probabilities for both classes
            return {"predictions": predictions, "probabilities": probabilities.tolist()}
        except Exception as e:
            print(f"Error durante la predicción: {e}")
            return None


    def evaluate(self, X_raw, y_raw):
        if not self.model_trained:
            print("Error: El modelo debe ser entrenado antes de la evaluación.")
            return {"error": "Modelo no entrenado."}

        if not X_raw or not y_raw:
            print("Error: Datos de prueba (X_raw o y_raw) no pueden estar vacíos.")
            return {"error": "Datos de prueba vacíos"}

        X_test_df = self._prepare_data(X_raw)
        y_test = np.array(y_raw)

        if X_test_df.empty:
            print("Error: DataFrame de prueba vacío después de la preparación.")
            return {"error": "DataFrame de prueba vacío"}
        if len(X_test_df) != len(y_test):
            print(f"Error: Desajuste en la cantidad de muestras X_test ({len(X_test_df)}) y y_test ({len(y_test)}).")
            return {"error": "Desajuste en muestras X_test/y_test"}

        try:
            y_pred = self.model.predict(X_test_df)

            # For regression, these would be different
            # For classification:
            accuracy = accuracy_score(y_test, y_pred)
            precision = precision_score(y_test, y_pred, zero_division=0)
            recall = recall_score(y_test, y_pred, zero_division=0)
            f1 = f1_score(y_test, y_pred, zero_division=0)
            cm = confusion_matrix(y_test, y_pred)

            # Dispersion / Error metrics (more typical for regression, but can be adapted)
            # For binary classification, 'loss' is more common (e.g. log_loss)
            # MAE/RMSE not directly applicable to classification outputs in this way typically
            # Simulating 'dispersion' as overall error rate (1 - accuracy)
            dispersion_error_rate = 1 - accuracy

            # "Fallas" (False Negatives + False Positives), "Acuertos" (True Positives + True Negatives)
            tn, fp, fn, tp = cm.ravel() if cm.size == 4 else (0,0,0,0) # handle cases where cm might not be 2x2
            fallas = fp + fn
            aciertos = tp + tn

            metrics = {
                "accuracy": accuracy,
                "precision": precision,
                "recall": recall,
                "f1_score": f1,
                "confusion_matrix": cm.tolist(), # [[tn, fp], [fn, tp]]
                "log_loss": None, # Placeholder, calculate if needed: from sklearn.metrics import log_loss; log_loss(y_test, self.model.predict_proba(X_test_df))
                "mae": None, # Not standard for classification like this
                "rmse": None, # Not standard for classification like this
                "dispersion_error_rate": dispersion_error_rate,
                "fallas_count": fallas,
                "aciertos_count": aciertos,
                "total_samples": len(y_test)
            }
            print(f"Evaluación completada: Accuracy: {accuracy:.4f}")
            return metrics
        except Exception as e:
            print(f"Error durante la evaluación: {e}")
            return {"error": str(e)}

    def save_model(self, filepath="trained_arbitrage_model.joblib"):
        print(f"Intentando guardar modelo y preprocesador en {filepath}...")
        if self.model: # self.model is the pipeline
            try:
                # Save the entire pipeline (which includes the preprocessor and the model)
                joblib.dump(self.model, filepath)
                print(f"Pipeline (modelo y preprocesador) guardado en {filepath}")
            except Exception as e:
                print(f"Error al guardar el pipeline: {e}")
        else:
            print("Error: No hay pipeline (modelo) para guardar.")

    def load_model(self, filepath="trained_arbitrage_model.joblib"):
        print(f"Intentando cargar modelo y preprocesador desde {filepath}...")
        try:
            # Load the entire pipeline
            self.model = joblib.load(filepath)
            # Extract preprocessor for potential individual use if needed, though pipeline handles it
            self.preprocessor = self.model.named_steps['preprocessor']
            self.model_trained = True # Assume a saved model is a trained one
            print(f"Pipeline (modelo y preprocesador) cargado desde {filepath}")
        except FileNotFoundError:
            print(f"Error: Archivo de modelo no encontrado en {filepath}. Se construirá uno nuevo.")
            self._build_model() # Build a new fresh model
        except Exception as e:
            print(f"Error al cargar el pipeline: {e}. Se construirá uno nuevo.")
            self._build_model() # Build a new fresh model on other errors
    
    def get_model_summary(self):
        if not self.model_trained or not hasattr(self.model.named_steps['classifier'], 'coef_'):
            return "Modelo no entrenado o no es un modelo lineal con coeficientes."

        classifier = self.model.named_steps['classifier']
        preprocessor = self.model.named_steps['preprocessor']

        try:
            # Get feature names after one-hot encoding
            cat_feature_names_out = preprocessor.named_transformers_['cat'].get_feature_names_out(self.categorical_features)
            # All feature names in the order they appear for the classifier
            all_feature_names = self.numeric_features + list(cat_feature_names_out)

            summary = {
                "model_type": type(classifier).__name__,
                "intercept": classifier.intercept_.tolist() if hasattr(classifier, 'intercept_') else 'N/A',
                "coefficients": {}
            }
            if hasattr(classifier, 'coef_'):
                # coef_ is 2D for multi-class, 1D for binary. Assuming binary for LogisticRegression.
                coeffs = classifier.coef_[0] if len(classifier.coef_.shape) > 1 else classifier.coef_
                summary["coefficients"] = dict(zip(all_feature_names, coeffs.tolist()))

            return summary
        except Exception as e:
            return f"Error generando resumen: {e}"


    def get_feature_importance(self):
        # For linear models, coefficients can be used as a proxy for feature importance (absolute magnitude)
        if not self.model_trained or not hasattr(self.model.named_steps['classifier'], 'coef_'):
            print("Modelo no entrenado o no es un modelo lineal. No se pueden obtener importancias de características basadas en coeficientes.")
            return None

        summary = self.get_model_summary()
        if isinstance(summary, str): # Error occurred
            return None

        importances = {k: abs(v) for k, v in summary.get("coefficients", {}).items()}
        # Sort by importance
        sorted_importances = dict(sorted(importances.items(), key=lambda item: item[1], reverse=True))
        return sorted_importances


# Example of how to prepare data and use the model (for developer reference)
if __name__ == '__main__':
    # Sample raw data (list of dictionaries)
    sample_data_raw = [
        {'gross_percentage_diff_sebo': 2.5, 'price_ex_min_buy_asset_sebo': 100, 'price_ex_max_sell_asset_sebo': 102.5,
         'ex_min_taker_fee_rate_sebo': 0.001, 'ex_max_taker_fee_rate_sebo': 0.001, 'asset_withdrawal_fee_from_ex_min_sebo': 0.0001,
         'initial_usdt_withdrawal_selected_fee': 1.0, 'ex_min_id_sebo': 'binance', 'ex_max_id_sebo': 'kraken', 'symbol_name': 'BTC'},
        {'gross_percentage_diff_sebo': 1.0, 'price_ex_min_buy_asset_sebo': 200, 'price_ex_max_sell_asset_sebo': 201.0,
         'ex_min_taker_fee_rate_sebo': 0.002, 'ex_max_taker_fee_rate_sebo': 0.002, 'asset_withdrawal_fee_from_ex_min_sebo': 0.0002,
         'initial_usdt_withdrawal_selected_fee': 0.5, 'ex_min_id_sebo': 'coinbase', 'ex_max_id_sebo': 'binance', 'symbol_name': 'ETH'},
        {'gross_percentage_diff_sebo': 3.0, 'price_ex_min_buy_asset_sebo': 150, 'price_ex_max_sell_asset_sebo': 154.5,
         'ex_min_taker_fee_rate_sebo': 0.001, 'ex_max_taker_fee_rate_sebo': 0.001, 'asset_withdrawal_fee_from_ex_min_sebo': 0.00015,
         'initial_usdt_withdrawal_selected_fee': 1.0, 'ex_min_id_sebo': 'binance', 'ex_max_id_sebo': 'gemini', 'symbol_name': 'BTC'},
         # Add more diverse data
        {'gross_percentage_diff_sebo': 0.5, 'price_ex_min_buy_asset_sebo': 300, 'price_ex_max_sell_asset_sebo': 301.0,
         'ex_min_taker_fee_rate_sebo': 0.001, 'ex_max_taker_fee_rate_sebo': 0.001, 'asset_withdrawal_fee_from_ex_min_sebo': 0.1, # Higher withdrawal fee
         'initial_usdt_withdrawal_selected_fee': 2.0, 'ex_min_id_sebo': 'kraken', 'ex_max_id_sebo': 'binance', 'symbol_name': 'ADA'},
        {'gross_percentage_diff_sebo': 1.5, 'price_ex_min_buy_asset_sebo': 100, 'price_ex_max_sell_asset_sebo': 101.5,
         'ex_min_taker_fee_rate_sebo': 0.0005, 'ex_max_taker_fee_rate_sebo': 0.0005, 'asset_withdrawal_fee_from_ex_min_sebo': 0.00005,
         'initial_usdt_withdrawal_selected_fee': 0.25, 'ex_min_id_sebo': 'binance', 'ex_max_id_sebo': 'kraken', 'symbol_name': 'BTC', 'some_other_column': 'test'}, # extra column
    ]
    # Corresponding target variable (1 for profitable, 0 for not)
    sample_y_raw = [1, 0, 1, 0, 1]

    print("--- Building Model ---")
    aim_model = ArbitrageIntelligenceModel()

    # print("\n--- Preparing Data (Example) ---")
    # prepared_X_df = aim_model._prepare_data(sample_data_raw)
    # print("Prepared X DataFrame head:\n", prepared_X_df.head())

    print("\n--- Training Model ---")
    # Split data for example
    X_train_raw, X_test_raw, y_train_raw, y_test_raw = train_test_split(sample_data_raw, sample_y_raw, test_size=0.4, random_state=42)

    train_history = aim_model.train(X_train_raw, y_train_raw)
    print("Training history/results:", train_history)

    if aim_model.model_trained:
        print("\n--- Making Predictions ---")
        predictions_output = aim_model.predict(X_test_raw)
        if predictions_output:
            print("Predictions:", predictions_output["predictions"])
            print("Probabilities:", predictions_output["probabilities"])

        print("\n--- Evaluating Model ---")
        eval_metrics = aim_model.evaluate(X_test_raw, y_test_raw)
        print("Evaluation metrics:", json.dumps(eval_metrics, indent=2))

        print("\n--- Model Summary ---")
        summary = aim_model.get_model_summary()
        print("Model Summary:", json.dumps(summary, indent=2) if summary else "N/A")

        print("\n--- Feature Importances (Absolute Coefs) ---")
        importances = aim_model.get_feature_importance()
        print("Feature Importances:", json.dumps(importances, indent=2) if importances else "N/A")

        print("\n--- Saving Model ---")
        aim_model.save_model("test_model.joblib")

        print("\n--- Loading Model (New Instance) ---")
        loaded_aim_model = ArbitrageIntelligenceModel(model_path="test_model.joblib")

        print("\n--- Making Predictions with Loaded Model ---")
        loaded_predictions_output = loaded_aim_model.predict(X_test_raw)
        if loaded_predictions_output:
            print("Loaded Model Predictions:", loaded_predictions_output["predictions"])

        print("\n--- Evaluating Loaded Model ---")
        loaded_eval_metrics = loaded_aim_model.evaluate(X_test_raw, y_test_raw) # Re-evaluate with loaded model
        print("Loaded Model Evaluation metrics:", json.dumps(loaded_eval_metrics, indent=2))
    else:
        print("Modelo no entrenado, saltando predicciones, evaluación y guardado.")
