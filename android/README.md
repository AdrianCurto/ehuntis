# EHUntis - Widget Nativo para Android

Widget de pantalla de inicio nativo para Android que muestra el horario de clases de la UPV/EHU en tiempo real, visualmente idéntico a la versión web de EHUntis.

## Características Principales
- **Fidelidad Gráfica en Canvas 2D**: Renderizado continuo sobre `Bitmap` (ARGB_8888) respetando al 100% las proporciones, la cuadrícula (07:30 a 21:30), la paleta de 16 colores (Claro y Oscuro) y los 7 niveles de ajuste tipográfico de `WeekCalendar.js`.
- **Doble Frecuencia Inteligente**:
  - **Red (cada 6 horas)**: `TimetableSyncWorker` (WorkManager) descarga datos frescos sin sobrecargar la red ni la batería.
  - **Tiempo Real (~15 min y al encender pantalla)**: Actualización de la línea azul de hora (`#4F6EF7`) y atenuación de clases concluidas con 0 peticiones a internet.
  - **Refresco Manual**: Botón `[ ↻ ]` en la cabecera del widget para forzar actualización inmediata.
- **Acceso Directo**: Tocar el horario abre inmediatamente `https://ehuntis.vercel.app` en el navegador.
- **Configuración en Jetpack Compose**: Actividad ligera con Material 3 (`WidgetConfigureActivity`) para vincular tu usuario de EHUntis, elegir perfil y seleccionar tema (Auto/Claro/Oscuro).
- **Fallback Resiliente**: Si un perfil se renombra o se borra en la web, el widget conmuta automáticamente al perfil activo de la cuenta sin mostrar errores.

## Estructura del Código
```
android/
├── app/src/main/
│   ├── java/com/ehuntis/widget/
│   │   ├── TimetableWidgetProvider.kt   # AppWidgetProvider y ciclo de vida del widget
│   │   ├── WidgetConfigureActivity.kt   # Pantalla de configuración en Jetpack Compose
│   │   ├── data/
│   │   │   ├── Models.kt                # Data classes (Usuario, Configuración, Horarios)
│   │   │   ├── DayLogic.kt              # Lógica matemática de fechas y resolución de día
│   │   │   ├── Subgroups.kt             # Extracción de subgrupos y filtrado de clases
│   │   │   ├── ApiClient.kt             # Cliente OkHttp para /api/user y /api/timetable
│   │   │   └── LocalCacheManager.kt     # Almacenamiento local en disco y SharedPreferences
│   │   ├── render/
│   │   │   ├── Palette.kt               # 16 colores idénticos (Claro/Oscuro) y asignación
│   │   │   ├── LayoutEngine.kt          # Disposición de columnas paralelas y ajuste tipográfico
│   │   │   └── TimetableRenderEngine.kt # Motor de dibujo en android.graphics.Canvas
│   │   ├── worker/
│   │   │   └── TimetableSyncWorker.kt   # Sincronización en segundo plano con WorkManager
│   │   ├── receiver/
│   │   │   ├── WidgetRefreshReceiver.kt # Manejador de click en botón de refresco
│   │   │   └── BootReceiver.kt          # Restauración de sincronización tras reinicio
│   │   └── ui/theme/                    # Colores y temas Material 3 para Compose
│   └── res/
│       ├── layout/                      # Layout XML del widget con cabecera e ImageView
│       ├── xml/                         # Metadatos del widget (redimensionable 3x2 a 5x5)
│       └── drawable/ y values/          # Iconos vectoriales y recursos de tema
```

## Compilación y Pruebas Locales

### Requisitos
- JDK 21 (o JDK de Android Studio `jbr`).
- Android SDK (API 34+).

### Comandos
1. **Ejecutar tests unitarios**:
   ```powershell
   .\gradlew.bat test
   ```
2. **Compilar APK de depuración (Debug)**:
   ```powershell
   .\gradlew.bat assembleDebug
   ```
   El APK compilado se genera en:
   `app/build/outputs/apk/debug/app-debug.apk`

3. **Compilar APK de producción (Release)**:
   ```powershell
   .\gradlew.bat assembleRelease
   ```
