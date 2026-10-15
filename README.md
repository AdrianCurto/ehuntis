<div align="center">
  <img src="public/icon-192.png" alt="EHUntis Logo" width="76" height="76" />
  <h1>EHUntis</h1>
  <p>Horarios universitarios de la <strong>UPV/EHU</strong> limpios, rápidos y con widgets para la pantalla de inicio.</p>

  <p>
    <a href="https://ehuntis.vercel.app"><img src="https://img.shields.io/badge/Web-ehuntis.vercel.app-4F6EF7?style=flat-square&logo=vercel&logoColor=white" alt="Web de EHUntis" /></a>
    <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js_16-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js" /></a>
    <a href="https://kotlinlang.org"><img src="https://img.shields.io/badge/Kotlin-Android-7F52FF?style=flat-square&logo=kotlin&logoColor=white" alt="Kotlin Android" /></a>
    <a href="https://supabase.com"><img src="https://img.shields.io/badge/Supabase-Database-1E293B?style=flat-square&logo=supabase&logoColor=3ECF8E" alt="Supabase" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/Licencia-MIT-22c55e?style=flat-square" alt="Licencia MIT" /></a>
  </p>
</div>

---

## ✨ ¿Qué es EHUntis?

**EHUntis** es una aplicación diseñada para que los estudiantes de la Universidad del País Vasco puedan consultar su horario de forma rápida, limpia y sin las complicaciones de la web tradicional de WebUntis.

### Funcionalidades principales

* **Búsqueda sencilla:** Encuentra tu grado y tu grupo en segundos.
* **Colores personalizados:** Asigna el color que prefieras a cada asignatura, con paleta adaptada para modo claro y modo oscuro.
* **Filtrado de subgrupos:** Oculta las clases de prácticas o laboratorios a los que no perteneces para ver solo tu horario real.
* **Nombres reales de profesores:** Resuelve automáticamente los códigos crudos de la universidad mostrando el nombre y apellidos de tus profesores.
* **Sincronización en la nube:** Guarda tu horario y colores con un identificador para acceder a ellos desde tu móvil, tablet u ordenador.

---

## 📱 Widgets para la Pantalla de Inicio *(En desarrollo)*

### 🤖 Widget Nativo de Android
* Muestra tu horario directamente en la pantalla de inicio, con un diseño visualmente casi idéntico al de la versión web.
* Muestra la hora actual y atenúa las clases que ya han terminado.
* Se actualiza automáticamente a lo largo del día sin consumir batería innecesaria.
* Configuración sencilla para elegir tu usuario, perfil y tema (automático, claro u oscuro).

### 🍎 Widget de iOS (Scriptable)
* Script para la app [Scriptable](https://scriptable.app) de iOS, con soporte para widgets medianos y grandes y modo oscuro integrado.

## 🛠️ Stack Tecnológico

* **Web & Frontend:** [Next.js 16](https://nextjs.org/) (App Router), [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/)
* **Widget Android:** [Kotlin](https://kotlinlang.org/) nativo con [Jetpack Glance / AppWidgets](https://developer.android.com/jetpack/compose/glance)
* **Widget iOS:** [Scriptable](https://scriptable.app/) (JavaScript)
* **Backend & Persistencia:** [Supabase](https://supabase.com/) (PostgreSQL con Row Level Security)
* **Métricas:** [PostHog](https://posthog.com/) y [Vercel Analytics](https://vercel.com/analytics)

---

## 💻 Desarrollo Local

### Aplicación Web
1. Clona el repositorio e instala las dependencias:
   ```bash
   git clone https://github.com/AdrianCurto/ehuntis.git
   cd ehuntis
   npm install
   ```
2. Configura las variables de entorno:
   ```bash
   cp .env.example .env.local
   ```
3. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```
4. Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

### Widget de Android
El código y la documentación técnica de la aplicación de Android se encuentran en la carpeta [android/](android/README.md).
```powershell
cd android
.\gradlew.bat test             # Ejecutar tests
.\gradlew.bat assembleDebug    # Compilar APK de prueba
```
*(Opcional: Puedes copiar `android/local.properties.example` a `android/local.properties` para configurar la ruta de tu SDK de Android).*

---

## 📄 Licencia

Este proyecto está bajo la licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más información.

---

<p align="center">
  <small><em>Aviso: EHUntis es un proyecto independiente de código abierto desarrollado por estudiantes y no tiene vinculación oficial ni afiliación con la Universidad del País Vasco / Euskal Herriko Unibertsitatea (UPV/EHU).</em></small>
</p>
