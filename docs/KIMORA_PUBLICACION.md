# Mis Finanzas · preparación de publicación

Marca: KIMORA SOFTWARE.

## Cambio de infraestructura

Se incorpora AAB firmado junto al APK cuando está configurada la firma privada existente. Ambos usan el alias `finanzas` y el mismo almacén de claves. Se publican como versiones preliminares, con un archivo SHA256SUMS.txt para verificar su integridad. Sin firma configurada se conserva la salida APK de prueba y no se ofrece un AAB como publicable.

## Validación

La validación independiente ejecuta las pruebas funcionales existentes de la interfaz y compila APK de depuración y AAB sin firma. Esos artefactos son exclusivamente de QA. No demuestra instalación en un teléfono ni aceptación en Play Console.

## Conservación de datos y funciones

Este cambio no modifica código de la app, identificador, almacenamiento, importación de cartolas, suscripciones ni recordatorios. Se conservan las claves existentes. La app nueva `cl.rarce.finanzashogar` y la app anterior son paquetes distintos: no anunciar migración automática de datos.

## Puertas antes de publicación comercial

- Verificar la identidad del paquete y certificado contra la ficha de Play y una instalación anterior.
- Probar instalación y actualización sin pérdida de datos en un dispositivo Android.
- Probar alta y edición de gastos, ingresos y cuentas; comprobantes; importación Excel/CSV y duplicados; suscripciones; recordatorios con la app cerrada; respaldo y restauración.
- Confirmar permisos, declaración de datos y política de privacidad según el código y servicios reales.
- Capturas reales, identidad KIMORA, ficha comercial y precio requieren validación antes de publicarse.
- Mantener el proceso existente hasta que la validación de esta propuesta pase.

## iOS

La interfaz basada en Capacitor puede reutilizarse. Aún faltan proyecto iOS, pruebas de plugins nativos, compilación en macOS y requisitos de publicación; no se declara compatibilidad iOS validada.
