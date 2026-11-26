# Migración Android 16 — propuesta KIMORA

Se actualizan Capacitor y sus plugins oficiales desde 6.x a 8.0.0, con Node 22 y Java 21. Android se genera desde la plantilla nueva, ya que no hay un proyecto Android persistido en este repositorio. Se conserva appId, firma y código web, incluidas claves de almacenamiento.

La verificación exige compileSdk/targetSdk 36 y confirma targetSdk=36 en el APK; no basta con instalar el SDK en el runner. Un script asigna versionCode y versionName tanto con sintaxis Gradle antigua como nueva y falla si no puede hacerlo. Los tags de publicación se alinean con 1.2.x.

Cambio de compatibilidad: la plantilla de Capacitor 8 usa minSdk 24 (Android 7). Antes de incorporar esta migración se debe revisar si es necesario mantener dispositivos Android 6. La compilación no demuestra compatibilidad funcional: faltan pruebas de actualización, almacenamiento WebView, permisos, archivos, compartir, notificaciones y márgenes de pantalla en Android 16. No borrar instalaciones para probar.

Fuentes de referencia: https://capacitorjs.com/docs/updating/8-0 y https://developer.android.com/google/play/requirements/target-sdk . Relacionado con issue #3. Esta rama no se publica en Google Play ni reemplaza la versión firmada existente hasta superar las comprobaciones.
