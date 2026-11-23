# Mis Gastos Chile V1

App Android nativa (Java) con almacenamiento SQLite local y sin cuentas ni publicidad.

## Funcionalidades
- Registrar ingresos, gastos y cuentas por pagar (pendientes o pagadas).
- Resumen de ingresos, gastos pagados, saldo y pendientes.
- Historial con eliminación previa confirmación.
- Adjuntar comprobante de imagen o PDF a cada movimiento y abrirlo desde la app.
- Exportar todos los movimientos en CSV compatible con Excel, usando el selector de archivos del dispositivo.
- Configurar moneda (CLP por defecto, USD, BRL, ARS, PEN, MXN, COP, EUR).

## Compilar en GitHub
1. Crear un repositorio nuevo `Mis_Gastos_Chile` y subir **el contenido** de este ZIP a la raíz.
2. Ir a **Actions** > **Compilar APK de prueba** > **Run workflow** (también se ejecuta al subir a main).
3. Cuando termine en verde, abrir el run y descargar el artefacto **Mis-Gastos-Chile-APK**.
4. Descomprimir y abrir `app-debug.apk` en el teléfono Android.

Esta es una compilación debug para pruebas. Publicar en Play Store requiere generar AAB firmado, identidad visual, ficha de privacidad y pruebas.

## Privacidad
Toda la base de movimientos queda local en el teléfono. Los comprobantes siguen en el proveedor de documentos que elija el usuario (la app guarda un permiso URI persistente cuando es posible). Exportación solo cuando el usuario la solicita. No hay envío a servidores.

## Estado
Proyecto fuente preparado para GitHub Actions con Gradle 8.11.1. La compilación real y las pruebas en dispositivo aún no se han ejecutado.
