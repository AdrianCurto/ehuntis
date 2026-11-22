# EHUntis - Widget Nativo para Android

Widget de pantalla de inicio nativo para Android que muestra el horario de clases de la UPV/EHU en tiempo real, visualmente idéntico a la versión web de EHUntis.

## Características Principales
- **Fidelidad Gráfica en Canvas 2D**: Renderizado continuo sobre `Bitmap` (ARGB_8888) respetando al 100% las proporciones, rango horario dinámico adaptado a las clases del día o semana, la paleta de 14 colores (Claro y Oscuro) y los 7 niveles de ajuste tipográfico de `WeekCalendar.js`.
- **Vista Diaria y Semanal**: Soporte completo para vista diaria compacta o vista semanal completa, adaptable mediante redimensionado (3×2 a 5×5).
- **Eventos Propios y Modificaciones**: Sincroniza clases movidas, aulas cambiadas y eventos personales creados en la web.
- **Eficiencia y Cero Fricción**:
  - **Red (cada 6 horas)**: `TimetableSyncWorker` (WorkManager) descarga datos frescos sin sobrecargar la red ni la batería. No requiere permisos especiales de exención de batería.
  - **Tiempo Real Reactivo (sin red)**: Actualización de la línea azul de hora (`#4F6EF7`) y atenuación de clases concluidas mediante alarmas exactas (`AlarmScheduler`) al inicio/fin de cada clase, al desbloquear la pantalla (`USER_PRESENT`) y con cambios horarios del sistema.
  - **Acciones Rápidas en Cabecera**: Botón de refresco `[ ↻ ]` para forzar sincronización inmediata y botón de ajustes `[ ⚙ ]` para reconfigurar el horario y vista del widget in-situ sin tener que borrarlo.
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
│   │   │   ├── AlarmScheduler.kt        # Programación de alarmas exactas para transiciones de clase
│   │   │   ├── ApiClient.kt             # Cliente OkHttp para /api/user y /api/timetable
│   │   │   ├── CustomEventsLogic.kt     # Normalización y reconciliación de eventos propios y overrides
│   │   │   ├── DayLogic.kt              # Lógica matemática de fechas y resolución de día
│   │   │   ├── LocalCacheManager.kt     # Almacenamiento local en disco y SharedPreferences
│   │   │   ├── Models.kt                # Data classes (Usuario, Configuración, Horarios)
│   │   │   ├── Subgroups.kt             # Extracción de subgrupos y filtrado de clases
│   │   │   └── WidgetAnalytics.kt       # Envío asíncrono y ligero de analíticas a PostHog
│   │   ├── render/
│   │   │   ├── Palette.kt               # 14 colores idénticos (Claro/Oscuro) y asignación
│   │   │   ├── LayoutEngine.kt          # Disposición de columnas paralelas y ajuste tipográfico
│   │   │   └── TimetableRenderEngine.kt # Motor de dibujo en android.graphics.Canvas
│   │   ├── worker/
│   │   │   └── TimetableSyncWorker.kt   # Sincronización en segundo plano con WorkManager
│   │   ├── receiver/
│   │   │   ├── BootReceiver.kt          # Restauración de sincronización tras reinicio
│   │   │   ├── PinnedReceiver.kt        # Recepción de confirmación al anclar widget (API 26+)
│   │   │   └── WidgetRefreshReceiver.kt # Manejador de click en botón de refresco
│   │   └── ui/theme/                    # Colores y temas Material 3 para Compose
│   └── res/
│       ├── layout/                      # Layouts XML del widget y de la vista previa
│       ├── xml/                         # Metadatos del widget (redimensionable 3x2 a 5x5)
│       └── drawable/, mipmap/ y values/ # Iconos vectoriales, lanzador y recursos de tema
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
   El APK compilado se genera en:
   `app/build/outputs/apk/release/`
