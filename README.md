# 📚 Aula Virtual - Instituto John H. Watson
## Sistema Profesional de Gestión Educativa

**Versión:** 1.0.0  
**Autor:** Instituto John H. Watson  
**Fecha:** 2026  
**Licencia:** MIT

---

## 📋 Tabla de Contenidos

1. [Descripción del Proyecto](#descripción-del-proyecto)
2. [Requisitos del Sistema](#requisitos-del-sistema)
3. [Instalación](#instalación)
4. [Configuración](#configuración)
5. [Estructura del Proyecto](#estructura-del-proyecto)
6. [API REST](#api-rest)
7. [Base de Datos](#base-de-datos)
8. [Guía de Uso](#guía-de-uso)
9. [Características Principales](#características-principales)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Descripción del Proyecto

**Aula Virtual** es un sistema web integral para la gestión de anuncios académicos, asignaturas, profesores y comunicación educativa en el Instituto John H. Watson.

### Características Principales:
- ✅ Gestión de anuncios con etiquetado automático
- ✅ Directorio de asignaturas y profesores
- ✅ Sistema de contacto con docentes
- ✅ Panel administrativo para publicar anuncios
- ✅ Interfaz responsiva y moderna
- ✅ Integración con base de datos MySQL
- ✅ API REST segura

---

## 💻 Requisitos del Sistema

### Software Requerido:
- **Node.js** v16.0.0 o superior
- **npm** v8.0.0 o superior
- **MySQL** v5.7 o superior (o MariaDB 10.3+)
- **Navegador Moderno** (Chrome, Firefox, Safari, Edge)

### Recursos Mínimos Recomendados:
- RAM: 2 GB
- Espacio en disco: 500 MB
- Conexión a internet: 5 Mbps

### Puertos Requeridos:
- Puerto **3000** para el servidor backend
- Puerto **3306** para MySQL

---

## 🚀 Instalación

### Paso 1: Clonar el Repositorio
```bash
git clone https://github.com/tomasestebanmonjesferragut-max/SolicitudesAcad-micas-EVA.4.git
cd SolicitudesAcad-micas-EVA.4
```

### Paso 2: Instalar Dependencias
```bash
npm install
```

### Paso 3: Crear Base de Datos

#### Opción A: Con npm (usa los datos del archivo `.env`)
```bash
npm run db
```

#### Opción B: Usando MySQL CLI
```bash
mysql -u root -p < data/instituto_watson.sql
```

#### Opción C: Usando phpMyAdmin
1. Abre `http://localhost/phpmyadmin`
2. Ve a la pestaña "Importar"
3. Selecciona el archivo `data/instituto_watson.sql`
4. Haz clic en "Continuar"

#### Opción D: Usando MySQL Workbench
1. Abre una nueva conexión SQL
2. Copia y pega el contenido de `data/instituto_watson.sql`
3. Ejecuta el script

### Paso 4: Configurar Variables de Entorno

Copia `.env.example` como `.env` en la raíz del proyecto y ajusta tus datos:
```bash
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root
DB_NAME=instituto_watson
PORT=3000
SESSION_SECRET=una-clave-larga-y-aleatoria
```

`SESSION_SECRET` firma la cookie de sesión. Si no se define, las sesiones se cierran cada vez que se reinicia el servidor.

### Paso 5: Iniciar el Servidor
```bash
# Modo producción
npm start

# Modo desarrollo (con auto-reload)
npm run dev
```

Deberías ver:
```
✅ Servidor Backend corriendo en http://localhost:3000
📁 Base de datos: instituto_watson
📊 Host: localhost
👤 Usuario: root
```

---

## ⚙️ Configuración

### Configuración de MySQL

#### Crear Usuario Específico (Recomendado)
```sql
CREATE USER 'aula_virtual'@'localhost' IDENTIFIED BY 'Segura@2026!';
GRANT ALL PRIVILEGES ON instituto_watson.* TO 'aula_virtual'@'localhost';
FLUSH PRIVILEGES;
```

### Configuración de CORS

Edita `server.js` si necesitas permitir otros orígenes:
```javascript
const corsOptions = {
    origin: ['http://localhost:3000', 'http://localhost:8080'],
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

### Configuración de Logging

Para activar logs más detallados, edita `server.js`:
```javascript
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});
```

---

## 📂 Estructura del Proyecto

```
SolicitudesAcad-micas-EVA.4/
├── public/
│   ├── html/
│   │   ├── index.html               Inicio, quiénes somos y contacto
│   │   ├── academico.html           Asignaturas, docentes y agenda
│   │   ├── aula.html                ⭐ Aula Virtual (alumnos y docentes)
│   │   └── tramites.html            Admisión y soporte docente
│   ├── js/
│   │   ├── script.js                Funciones comunes (sesión, menú, tema)
│   │   ├── inicio.js
│   │   ├── academico.js
│   │   ├── aula.js                  ⭐ Lógica del Aula Virtual
│   │   └── tramites.js
│   ├── css/
│   │   └── styles.css
│   └── Image/
│       └── [imágenes]
├── server.js                        ⭐ Backend
├── package.json
├── data/
│   └── instituto_watson.sql         ⭐ Script DB
├── .env                            [Tu configuración]
└── README.md
```

---

## 🔌 API REST

### Autenticación
La API usa sesión en el servidor (cookie `httpOnly`) y contraseñas cifradas con bcrypt. Se inicia sesión con `POST /api/auth/login` (correo y contraseña) y el servidor detecta el rol.

| Rol | Puede |
|---|---|
| Sin sesión | Información del instituto, asignaturas que se imparten (sin datos de docentes), postular, consultar su postulación y escribir a contacto |
| Alumno / Apoderado | Materias con su docente, horario, Aula Virtual, avisos y solo las notas del alumno |
| Profesor | Editar lo que se enseña en sus asignaturas, su Aula Virtual (material y notas), ver datos de contacto de los alumnos y reportar fallas en Soporte |
| Secretaría | Admisión, mensajes, anuncios, horario, asignaturas, soporte y ficha completa de alumnos |
| Director | Todo lo anterior, notas de todos los alumnos y crear o editar docentes |

Los intentos fallidos de inicio de sesión se limitan a 10 cada 15 minutos.

### Base URL
```
http://localhost:3000/api
```

### Endpoints Disponibles

#### 1️⃣ Información Académica (según el rol)
```http
GET /resumen        Cifras públicas (asignaturas y docentes)
GET /asignaturas    Materias; con sesión incluye el docente a cargo
GET /docentes       Con sesión: nombre, asignaturas y correo; la directiva ve la ficha completa y cada profesor solo la suya
GET /horario        Agenda semanal y avisos (con sesión)
```

#### 2️⃣ Anuncios del Aula Virtual

**Crear Anuncio:**
```http
POST /anuncios_aula
Content-Type: application/json

{
    "id": "AV-123456",
    "titulo": "Examen Programado",
    "contenido": "Se realizará el próximo martes...",
    "autor": "Dr. Carlos Mendoza",
    "fecha": "2026-06-27"
}
```

**Respuesta:**
```json
{
    "message": "Anuncio publicado correctamente",
    "id": "AV-123456"
}
```

**Eliminar Anuncio:**
```http
DELETE /anuncios_aula/AV-123456
```

#### 3️⃣ Gestión de Asignaturas

**Crear Asignatura:**
```http
POST /asignaturas
Content-Type: application/json

{
    "id": "ASIG005",
    "codigo": "FIS101",
    "nombre": "Física General",
    "profesor_id": "PROF001",
    "color": "info"
}
```

**Actualizar Asignatura:**
```http
PUT /asignaturas/ASIG005
Content-Type: application/json

{
    "codigo": "FIS101",
    "nombre": "Física General Actualizada",
    "profesor_id": "PROF002",
    "color": "success"
}
```

#### 4️⃣ Gestión de Profesores

**Crear Profesor:**
```http
POST /profesores
Content-Type: application/json

{
    "id": "PROF005",
    "nombre": "Dra. Rosa Martínez",
    "departamento": "Ciencias Sociales"
}
```

#### 5️⃣ Postulaciones (alumnos y docentes)

```http
POST /postulaciones_alumnos     Postulación de un alumno nuevo (público)
POST /postulaciones_docentes    Postulación de un docente nuevo (público)
GET  /postulaciones/estado?folio=ADM-1234567&correo=...   Consultar estado (ADM- alumno, DOC- docente)
GET  /postulaciones_alumnos     Lista (directiva)
GET  /postulaciones_docentes    Lista (directiva)
```

---

## 🗄️ Base de Datos

Una sola base (`instituto_watson`) organizada en 4 grupos dentro de `data/instituto_watson.sql`:

```
1. POSTULANTES
   postulaciones_alumnos    (alumnos que quieren entrar)
   postulaciones_docentes   (docentes que quieren trabajar en el instituto)

2. ALUMNOS (inscritos)
   estudiantes              (alumno y su apoderado, con sus accesos)

3. PROFESORES (contratados)
   profesores               (ficha del docente y su acceso)

4. AULA VIRTUAL
   asignaturas     → profesores
   horarios        → asignaturas
   recursos_aula   → asignaturas
   calificaciones  → estudiantes, asignaturas
   anuncios_aula, notas (avisos)

DIRECTIVA Y COMUNICACIÓN
   administradores (director y secretaría), tickets_soporte, mensajes_contacto
```

### Consultas Útiles

**Ver los anuncios más recientes:**
```sql
SELECT * FROM anuncios_aula
ORDER BY creado_en DESC
LIMIT 10;
```

**Ver asignaturas de un profesor:**
```sql
SELECT a.* FROM asignaturas a
JOIN profesores p ON a.profesor_id = p.id
WHERE p.nombre LIKE '%Carlos%';
```

**Contar postulaciones de alumnos por estado:**
```sql
SELECT estado, COUNT(*) as total
FROM postulaciones_alumnos
GROUP BY estado;
```

**Ver carga de trabajo de profesores:**
```sql
SELECT p.nombre, COUNT(a.id) as asignaturas
FROM profesores p
LEFT JOIN asignaturas a ON p.id = a.profesor_id
GROUP BY p.id, p.nombre;
```

---

## 📖 Guía de Uso

### Para Estudiantes:

1. **Acceder al Aula Virtual:**
   - Navega a `http://localhost:3000/html/aula.html` e inicia sesión con tu correo institucional

2. **Ver Anuncios:**
   - Los anuncios se cargan automáticamente
   - Usa el buscador para filtrar por título, contenido o autor

3. **Marcar como Importante:**
   - Haz clic en el corazón (❤️) para guardar anuncios importantes

4. **Copiar Contenido:**
   - Usa el botón de compartir para copiar al portapapeles

5. **Ver Asignaturas:**
   - Accede a la sección "Mis Asignaturas"
   - Haz clic en "Ver Material" para descargar recursos

6. **Contactar Profesores:**
   - Ve a "Directorio Docente"
   - Haz clic en "Contactar Docente" para enviar mensaje

### Para Administradores:

1. **Acceso de Administrador:**
   - Haz clic en el botón de candado (🔒) en la esquina superior derecha
   - Contraseña: `admin2026` (cambiar en producción)

2. **Publicar Anuncio:**
   - Aparecerá el botón "Publicar" (solo para admins)
   - Completa el formulario y publica

3. **Eliminar Anuncio:**
   - En cada anuncio aparecerá un botón de basura (🗑️)
   - Confirma la eliminación

---

## ⭐ Características Principales

### 1. Gestión de Anuncios
- ✅ Publicación de anuncios por administrativos
- ✅ Etiquetado automático (Evaluación, Importante, Material, Tarea, Evento)
- ✅ Búsqueda por título, contenido o autor
- ✅ Sistema de "likes" para marcar favoritos
- ✅ Copiar al portapapeles

### 2. Directorio de Asignaturas
- ✅ Visualización de todas las asignaturas
- ✅ Información del profesor asignado
- ✅ Código y nombre de la asignatura
- ✅ Acceso a material de descarga

### 3. Directorio de Profesores
- ✅ Listado completo de docentes
- ✅ Información de contacto
- ✅ Departamento/Área
- ✅ Horarios de atención
- ✅ Sistema de mensajería

### 4. Interfaz de Usuario
- ✅ Diseño responsivo (mobile-first)
- ✅ Tema oscuro elegante
- ✅ Iconos Bootstrap
- ✅ Animaciones suaves
- ✅ Notificaciones con SweetAlert2

### 5. Seguridad
- ✅ Escape de caracteres HTML (XSS prevention)
- ✅ Validación de datos en cliente y servidor
- ✅ Control de acceso por roles (admin)
- ✅ Manejo de errores robusto

---

## 🐛 Troubleshooting

### Problema: "Error al conectar con MySQL"

**Solución:**
```bash
# Verifica que MySQL esté corriendo
sudo service mysql status

# Si no está corriendo, inicia el servicio
sudo service mysql start

# Verifica credenciales en .env
cat .env
```

### Problema: "Puerto 3000 ya está en uso"

**Solución:**
```bash
# Encuentra qué proceso usa el puerto 3000
lsof -i :3000

# Mata el proceso
kill -9 <PID>

# O cambia el puerto en .env
echo "PORT=3001" >> .env
```

### Problema: "CORS error" en consola del navegador

**Solución:**
```javascript
// En server.js, agrega tu origen
const corsOptions = {
    origin: 'http://tu-dominio.com',
    credentials: true
};
app.use(cors(corsOptions));
```

### Problema: "Las imágenes no cargan"

**Solución:**
```bash
# Verifica que las imágenes existan
ls -la public/Image/

# Si no existen, crea la carpeta
mkdir -p public/Image

# Coloca las imágenes en esa carpeta
```

### Problema: "Anuncios no se guardan"

**Solución:**
1. Verifica que la tabla `anuncios_aula` existe:
   ```sql
   DESCRIBE anuncios_aula;
   ```

2. Verifica los logs del servidor:
   ```bash
   npm run dev
   ```

3. Comprueba la respuesta de la API en el navegador (F12 → Network)

---

## 🔐 Seguridad en Producción

### Checklist:

- [ ] Cambiar contraseña de MySQL
- [x] Usar variables de entorno en lugar de hardcodear credenciales
- [x] Implementar autenticación (sesiones con roles)
- [ ] Usar HTTPS en lugar de HTTP
- [ ] Configurar CORS correctamente
- [x] Validar y sanitizar todas las entradas
- [x] Implementar rate limiting
- [ ] Usar firewalls
- [ ] Crear backups regulares de la BD
- [ ] Implementar logging y monitoreo

### Implementar JWT (Ejemplo):

```javascript
const jwt = require('jsonwebtoken');

app.post('/api/login', (req, res) => {
    const user = { id: 1, email: 'admin@institusjw.edu' };
    const token = jwt.sign(user, 'tu-clave-secreta', { expiresIn: '1h' });
    res.json({ token });
});

const verificarToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: 'No autorizado' });
    
    jwt.verify(token, 'tu-clave-secreta', (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Token inválido' });
        req.user = decoded;
        next();
    });
};
```

---

## 📞 Soporte

Para reportar bugs o solicitar features:
- 📧 Email: soporte@institusjw.edu
- 🐛 Issues: GitHub Issues
- 💬 Discusiones: GitHub Discussions

---

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Ver archivo LICENSE para más detalles.

---

## 👨‍💻 Contribuidores

- Instituto John H. Watson
- Equipo de Desarrollo Académico

---

**Última actualización:** 27 de junio de 2026