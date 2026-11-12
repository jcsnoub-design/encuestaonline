# Sistema de Encuesta de Satisfacción - Curso Antigravity

Página web responsiva y segura para recolectar opiniones y calificaciones de los estudiantes del curso **Antigravity**, con sincronización en tiempo real hacia **Airtable** y disparo de notificaciones vía **n8n**.

---

## 🚀 Características

- **Diseño Moderno y Responsivo**: Interfaz cuidada con CSS variables, animaciones suaves y componentes adaptables a móviles, tablets y monitores de escritorio.
- **Escala de Calificación Interactiva**: Botones de escala del 1 al 5 para:
  - Nivel de satisfacción general.
  - Claridad del contenido.
  - Aplicabilidad práctica.
- **Backend Seguro (Zero Dependencies)**:
  - Construido utilizando los módulos nativos de **Node.js** (`http`, `fs`, `fetch`, `path`).
  - **Ocultamiento Total de Secretos**: El token de Airtable y el Webhook de n8n residen de forma privada en el servidor mediante variables de entorno (`.env`). Nunca se exponen al navegador.
  - **Rate Limiting**: Limitador de peticiones para evitar ataques de denegación de servicio (DoS) o spam masivo.
  - **Protección Anti-Bot (Honeypot)**: Detección y descarte automático de envíos realizados por scripts y bots automatizados.
  - **Validación y Sanitización Estricta**: Control estricto de tipos de datos y neutralización de ataques de inyección HTML/XSS.
  - **Cabeceras de Seguridad**: Implementación de Content Security Policy (CSP), anti-clickjacking (`X-Frame-Options: DENY`) y `nosniff`.

---

## 🛠️ Tecnologías

- **Frontend**: HTML5 Semántico, CSS3 moderno, JavaScript (Vanilla ES6+).
- **Backend**: Node.js (Servidor HTTP nativo con soporte de `.env`).
- **Base de Datos**: [Airtable](https://airtable.com).
- **Automatización**: [n8n](https://n8n.io).

---

## 📦 Estructura del Proyecto

```text
proyecto-encuesta/
├── index.html        # Estructura del formulario y modal de confirmación
├── style.css         # Estilos visuales, temas y diseño responsivo
├── script.js         # Lógica del cliente y validación de formulario
├── server.js         # Backend proxy seguro, validaciones y conexión con APIs
├── .env.example      # Plantilla de variables de entorno (sin credenciales)
├── .gitignore        # Exclusión de archivos sensibles (.env)
└── package.json      # Configuración y scripts del proyecto
```

---

## ⚡ Instalación y Puesta en Marcha

### 1. Clonar el repositorio
```bash
git clone https://github.com/jcsnoub-design/encuestaonline.git
cd encuestaonline
```

### 2. Configurar las variables de entorno
Copia la plantilla `.env.example` a un archivo `.env`:
```bash
cp .env.example .env
```
Edita `.env` con tus credenciales:
```env
PORT=3000
AIRTABLE_TOKEN=tu_personal_access_token_de_airtable
AIRTABLE_BASE_ID=tu_base_id
AIRTABLE_TABLE_ID=tu_tabla_id
N8N_WEBHOOK_URL=https://tu-instancia.n8n.cloud/webhook/tu-webhook-id
```

### 3. Ejecutar el servidor
No requiere instalar dependencias externas pesadas:
```bash
node server.js
```
*(o `npm start`)*

### 4. Acceder a la encuesta
Abre tu navegador en:
```text
http://localhost:3000
```
