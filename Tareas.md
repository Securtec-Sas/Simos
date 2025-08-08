** requerimientos funcionales y no funcionales faltan tes **

1- Obtención de datos y conversión de datos 
  a- UI/clients/aiDataPage.jsx -> debe al accionar el button de entrenamiento "ai_trade_model"-> cargar archivo cvs iniciar el entrenamiento del modelo, activar spiner y bloqueo de pagina hasta finalizar y recibir datos finales 
2- en ui agregar variables para archivo, recibir únicamente cvs, emitir la señal de test a V3 e igual q en entrenamiento esperar resultados
3 - se debe realizar en sandbox de los exchanges tomando un balance y realizando todo el proceso, almacenar datos y retroalimentar modelo.
en caso de el exchange no tenga api key saltar popuup para agregarlo y continuar con otro symbolo.
ordenar en gráfica los datos de aiDataPage.jsx 