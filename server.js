const http = require('http');
const fs = require('fs');
const path = require('path');

// 1. Cargar variables de entorno desde .env nativamente sin librerías externas
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...rest] = trimmed.split('=');
        const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
        // Actualizar siempre con el valor más reciente del archivo .env
        process.env[key.trim()] = val;
      }
    });
  }
}
loadEnv();

const PORT = parseInt(process.env.PORT, 10) || 3000;

// 2. Rate Limiting en memoria (Prevenir ataques de fuerza bruta, spam masivo o DoS)
const rateLimitMap = new Map();
function checkRateLimit(ip, maxRequests = 10, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };

  if (now > entry.resetTime) {
    entry.count = 0;
    entry.resetTime = now + windowMs;
  }

  entry.count += 1;
  rateLimitMap.set(ip, entry);
  return entry.count <= maxRequests;
}

// Limpieza periódica del mapa de IPs para evitar fugas de memoria
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 30 * 60 * 1000);

// 3. Función auxiliar para sanitizar cadenas (prevenir inyecciones XSS)
function sanitizeString(str, maxLength = 500) {
  if (typeof str !== 'string') return '';
  return str
    .slice(0, maxLength)
    .trim()
    .replace(/[<>]/g, ''); // Remueve caracteres de etiquetas HTML
}

// Tipos MIME para los archivos estáticos
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// 4. Crear el Servidor HTTP Seguro
const server = http.createServer(async (req, res) => {
  const clientIp = req.socket.remoteAddress || 'unknown';

  // Inyección de Cabeceras de Seguridad (Protección contra Clickjacking, MIME-sniffing, XSS)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self';"
  );

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // -------------------------------------------------------------
  // ENDPOINT POST /api/encuesta (Procesador seguro de la encuesta)
  // -------------------------------------------------------------
  if (pathname === '/api/encuesta' && req.method === 'POST') {
    // Control de límite de peticiones (Rate Limit)
    if (!checkRateLimit(clientIp, 10, 15 * 60 * 1000)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Has excedido el número de intentos permitidos. Por favor espera unos minutos antes de volver a enviar.'
      }));
    }

    // Leer el cuerpo de la petición con límite estricto de tamaño (10 KB max)
    let body = '';
    let bodySize = 0;
    const MAX_BODY_SIZE = 10 * 1024; // 10 KB

    req.on('data', chunk => {
      bodySize += chunk.length;
      if (bodySize > MAX_BODY_SIZE) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Cuerpo de la petición demasiado grande.' }));
        req.destroy();
        return;
      }
      body += chunk;
    });

    req.on('end', async () => {
      try {
        let data;
        try {
          data = JSON.parse(body);
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'JSON malformado o inválido.' }));
        }

        const {
          id_estudiante,
          nivel_satisfaccion,
          claridad_contenido,
          aplicabilidad_practica,
          comentarios_adicionales,
          _hp_website
        } = data;

        // A. Protección Honeypot Anti-Bot
        if (_hp_website) {
          console.warn(`🛡️ [Anti-Bot] Intento de bot detectado desde ${clientIp}. Descartado.`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, message: 'Recibido' }));
        }

        // B. Validación Estricta en el Servidor
        const cleanId = sanitizeString(id_estudiante, 60);
        if (!cleanId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: 'El identificador del estudiante es obligatorio (máximo 60 caracteres).'
          }));
        }

        const sat = Number(nivel_satisfaccion);
        const cla = Number(claridad_contenido);
        const apl = Number(aplicabilidad_practica);

        const isValidScore = n => Number.isInteger(n) && n >= 1 && n <= 5;
        if (!isValidScore(sat) || !isValidScore(cla) || !isValidScore(apl)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: 'Las calificaciones deben ser números enteros del 1 al 5.'
          }));
        }

        const cleanComentarios = sanitizeString(comentarios_adicionales, 1500);

        // C. Obtener credenciales desde variables de entorno seguras (recarga dinámica)
        loadEnv();
        const {
          AIRTABLE_TOKEN,
          AIRTABLE_BASE_ID,
          AIRTABLE_TABLE_ID,
          AIRTABLE_FLD_ID_ESTUDIANTE = 'fld69UeG8htOOpRFm',
          AIRTABLE_FLD_NIVEL_SATISFACCION = 'fldX8fl3a03ZGfk0J',
          AIRTABLE_FLD_CLARIDAD_CONTENIDO = 'fld7nISTabqZDi68Z',
          AIRTABLE_FLD_APLICABILIDAD_PRACTICA = 'fldZBYF7gvgAK3pXZ',
          AIRTABLE_FLD_COMENTARIOS = 'fld7QVehzKROs7wtW',
          N8N_WEBHOOK_URL
        } = process.env;

        if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_ID) {
          console.error('❌ Falta configuración de Airtable en el archivo .env');
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: 'Error de configuración interna en el servidor: faltan variables en .env.'
          }));
        }

        // D. Guardar en Airtable de forma segura desde el backend
        const airtableEndpoint = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;
        const airtablePayload = {
          fields: {
            [AIRTABLE_FLD_ID_ESTUDIANTE]: cleanId,
            [AIRTABLE_FLD_NIVEL_SATISFACCION]: sat,
            [AIRTABLE_FLD_CLARIDAD_CONTENIDO]: cla,
            [AIRTABLE_FLD_APLICABILIDAD_PRACTICA]: apl,
            [AIRTABLE_FLD_COMENTARIOS]: cleanComentarios
          }
        };

        const airtableRes = await fetch(airtableEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(airtablePayload)
        });

        if (!airtableRes.ok) {
          const errDetail = await airtableRes.text();
          console.error(`❌ Error de Airtable API (${airtableRes.status}):`, errDetail);

          let errorMsg = 'No se pudo guardar la respuesta en Airtable.';
          if (airtableRes.status === 401) {
            errorMsg = 'Error de autenticación: El token de Airtable es inválido o ha sido revocado. Por favor ingresa un token válido en AIRTABLE_TOKEN del archivo .env.';
          } else {
            try {
              const parsed = JSON.parse(errDetail);
              if (parsed.error && parsed.error.message) {
                errorMsg = `Error de Airtable: ${parsed.error.message}`;
              }
            } catch (e) {}
          }

          res.writeHead(airtableRes.status === 401 ? 401 : 502, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: errorMsg
          }));
        }

        const airtableData = await airtableRes.json();
        const airtableRecordId = airtableData.id;
        console.log(`✅ Registro seguro creado en Airtable: ${airtableRecordId}`);

        // E. Disparar Webhook de n8n desde el backend (URL secreta no expuesta)
        if (N8N_WEBHOOK_URL) {
          try {
            const n8nPayload = {
              id_estudiante: cleanId,
              nivel_satisfaccion: sat,
              claridad_contenido: cla,
              aplicabilidad_practica: apl,
              comentarios_adicionales: cleanComentarios,
              airtable_id: airtableRecordId,
              fecha_registro: new Date().toISOString(),
              IDEstudiante: cleanId,
              NivelSatisfaccion: sat,
              ClaridadContenido: cla,
              AplicabilidadPractica: apl,
              ComentariosAdicionales: cleanComentarios
            };

            const n8nRes = await fetch(N8N_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(n8nPayload)
            });

            if (!n8nRes.ok) {
              console.warn(`⚠️ n8n respondió con código ${n8nRes.status}`);
            } else {
              console.log('✅ Webhook de n8n ejecutado exitosamente desde el servidor.');
            }
          } catch (n8nErr) {
            console.warn('⚠️ Error al contactar n8n webhook:', n8nErr.message);
          }
        }

        // F. Responder al cliente de forma limpia sin exponer claves ni IDs sensibles
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          message: 'Encuesta registrada con éxito.'
        }));
      } catch (err) {
        console.error('❌ Error no controlado en /api/encuesta:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: false,
          error: 'Error interno al procesar la encuesta.'
        }));
      }
    });

    return;
  }

  // -------------------------------------------------------------
  // SERVIR ARCHIVOS ESTÁTICOS (index.html, style.css, script.js)
  // -------------------------------------------------------------
  if (req.method === 'GET') {
    let filePath = pathname === '/' ? '/index.html' : pathname;
    const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(__dirname, safePath);

    // Evitar salir del directorio base (Path Traversal Protection)
    if (!fullPath.startsWith(__dirname)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('403 Prohibido');
    }

    fs.stat(fullPath, (err, stats) => {
      if (err || !stats.isFile()) {
        // Fallback a index.html si no se encuentra
        const indexPath = path.join(__dirname, 'index.html');
        fs.readFile(indexPath, (indexErr, indexData) => {
          if (indexErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('404 No encontrado');
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
          res.end(indexData);
        });
        return;
      }

      const ext = path.extname(fullPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      fs.readFile(fullPath, (readErr, content) => {
        if (readErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          return res.end('500 Error de lectura');
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      });
    });
    return;
  }

  // Método no permitido
  res.writeHead(405, { 'Content-Type': 'text/plain' });
  res.end('405 Método no permitido');
});

// Iniciar servidor
server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🛡️  SERVIDOR SEGURO ACTIVO: http://localhost:${PORT}`);
  console.log(`🔒  Token de Airtable protegido en servidor (.env)`);
  console.log(`🔒  Webhook de n8n protegido en servidor (.env)`);
  console.log(`🛡️  Protección Anti-Bot (Honeypot) & Rate Limiting activa`);
  console.log(`=======================================================`);
});
