/**
 * Servidor Backend - Aula Virtual
 * Archivo: server.js
 * Descripción: API REST para gestión de anuncios, asignaturas, profesores y solicitudes
 * Versión: 1.1.0
 * Autor: Instituto John H. Watson
 * Fecha: 2026
 */

'use strict';

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

// Cargar variables de entorno desde .env (si existe)
try { process.loadEnvFile(path.join(__dirname, '.env')); } catch (error) { /* sin .env se usan los valores por defecto */ }

// =============================================
// INICIALIZACIÓN DE EXPRESS
// =============================================
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// Sesión del usuario (cookie httpOnly; los datos quedan en el servidor)
app.use(session({
    name: 'jhw.sid',
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 2 // 2 horas
    }
}));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// =============================================
// CONFIGURACIÓN DE BASE DE DATOS
// =============================================
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? 'root',
    database: process.env.DB_NAME || 'instituto_watson',
    dateStrings: true, // fechas como texto AAAA-MM-DD, sin desfase de zona horaria
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Crear pool de conexiones
const pool = mysql.createPool(dbConfig);

// =============================================
// SEGURIDAD: LÍMITES, PERMISOS Y VALIDACIONES
// =============================================
// Frena ataques de fuerza bruta (solo cuentan los intentos fallidos)
const limiteIntentos = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Demasiados intentos fallidos. Espera 15 minutos e inténtalo nuevamente.' }
});

// Evita el envío masivo de formularios públicos (spam)
const limiteFormularios = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Has enviado demasiados formularios. Inténtalo nuevamente en una hora.' }
});

/**
 * Exige una sesión iniciada y, si se indican, uno de los roles permitidos
 */
const requiereSesion = (...roles) => (req, res, next) => {
    const usuario = req.session.usuario;
    if (!usuario) {
        return res.status(401).json({ error: 'Debes iniciar sesión para continuar' });
    }
    if (roles.length > 0 && !roles.includes(usuario.rol)) {
        return res.status(403).json({ error: 'No tienes permiso para realizar esta acción' });
    }
    next();
};

/**
 * El admin gestiona todas las asignaturas; el profesor solo las que tiene a cargo
 */
async function puedeGestionarAsignatura(usuario, asignaturaId) {
    if (usuario.rol === 'admin') return true;
    if (usuario.rol !== 'profesor') return false;
    const [rows] = await pool.query(
        'SELECT id FROM asignaturas WHERE id = ? AND profesor_id = ?',
        [asignaturaId, usuario.id]
    );
    return rows.length > 0;
}

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_VALIDA = /^https?:\/\//i;
const ANIOS_POSTULACION = ['1° Medio', '2° Medio', '3° Medio', '4° Medio'];
const PRIORIDADES = ['Baja', 'Media', 'Alta'];
const ESTADOS_POSTULACION = ['En Revisión', 'Aceptado', 'Lista de Espera', 'Rechazado'];

// Texto obligatorio y con largo máximo
const textoValido = (texto, maximo) => typeof texto === 'string' && texto.trim().length > 0 && texto.trim().length <= maximo;

// Identificador único con prefijo (ej: ADM-4821937)
const nuevoId = (prefijo) => `${prefijo}${Date.now().toString().slice(-7)}`;

// Fecha de hoy en formato chileno (dd/mm/aaaa), igual que los datos de ejemplo
const fechaHoy = () => new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date()).replace(/-/g, '/');

// Ordena por una columna de texto dd/mm/aaaa como fecha real (y no alfabéticamente)
const ORDEN_FECHA = (columna) => `STR_TO_DATE(${columna}, '%d/%m/%Y') DESC`;

// =============================================
// RUTAS GENERALES
// =============================================
app.get('/', (req, res) => {
    res.redirect('/html/index.html');
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// =============================================
// API: LECTURA PÚBLICA DE LA BASE DE DATOS
// =============================================
/**
 * GET /api/db - Datos públicos del portal
 * Retorna: profesores, asignaturas, horarios, anuncios y avisos (sin datos personales)
 */
app.get('/api/db', async (req, res) => {
    const [profesores] = await pool.query('SELECT id, nombre, departamento FROM profesores');
    const [asignaturas] = await pool.query('SELECT id, codigo, nombre, profesor_id, color FROM asignaturas');
    const [horarios] = await pool.query('SELECT * FROM horarios');
    const [anuncios_aula] = await pool.query('SELECT id, titulo, contenido, autor, fecha FROM anuncios_aula ORDER BY creado_en DESC');
    const [notasRows] = await pool.query('SELECT descripcion FROM notas');

    res.json({
        profesores,
        asignaturas,
        horarios,
        anuncios_aula,
        notas: notasRows.map(n => n.descripcion),
        timestamp: new Date().toISOString()
    });
});

// =============================================
// AUTENTICACIÓN (login único para todos los roles)
// =============================================
/**
 * Busca el correo en administradores, profesores, alumnos y apoderados (en ese orden)
 * y compara la contraseña cifrada. Retorna { rol, id, nombre } o null.
 */
async function buscarUsuario(correo, contrasena) {
    const coincide = async (fila, hash) => fila && hash && await bcrypt.compare(contrasena, hash);

    const [[admin]] = await pool.query('SELECT id, nombre, contrasena FROM administradores WHERE correo = ?', [correo]);
    if (await coincide(admin, admin?.contrasena)) return { rol: 'admin', id: admin.id, nombre: admin.nombre };

    const [[profesor]] = await pool.query('SELECT id, nombre, contrasena FROM profesores WHERE correo = ?', [correo]);
    if (await coincide(profesor, profesor?.contrasena)) return { rol: 'profesor', id: profesor.id, nombre: profesor.nombre };

    const [[alumno]] = await pool.query('SELECT id, nombre, contrasena_alumno FROM estudiantes WHERE correo_alumno = ?', [correo]);
    if (await coincide(alumno, alumno?.contrasena_alumno)) return { rol: 'alumno', id: alumno.id, nombre: alumno.nombre };

    const [[apoderado]] = await pool.query('SELECT id, apoderado_nombre, contrasena_apoderado FROM estudiantes WHERE correo_apoderado = ?', [correo]);
    if (await coincide(apoderado, apoderado?.contrasena_apoderado)) return { rol: 'apoderado', id: apoderado.id, nombre: apoderado.apoderado_nombre || 'Apoderado/a' };

    return null;
}

/**
 * Datos que recibe el navegador según el rol de la sesión
 */
async function datosSesion(usuario) {
    if (usuario.rol === 'admin') {
        const [[admin]] = await pool.query('SELECT id, nombre, correo FROM administradores WHERE id = ?', [usuario.id]);
        return admin ? { rol: 'admin', nombre: admin.nombre, admin } : null;
    }
    if (usuario.rol === 'profesor') {
        const [[profesor]] = await pool.query('SELECT id, nombre, departamento FROM profesores WHERE id = ?', [usuario.id]);
        if (!profesor) return null;
        const [asignaturas] = await pool.query('SELECT id, codigo, nombre, color FROM asignaturas WHERE profesor_id = ?', [profesor.id]);
        return { rol: 'profesor', nombre: profesor.nombre, profesor, asignaturas };
    }
    const [[estudiante]] = await pool.query('SELECT id, nombre, curso, apoderado_nombre FROM estudiantes WHERE id = ?', [usuario.id]);
    if (!estudiante) return null;
    return { rol: usuario.rol, nombre: usuario.nombre, estudiante };
}

/**
 * POST /api/auth/login - Inicia sesión y detecta automáticamente el rol
 */
app.post('/api/auth/login', limiteIntentos, async (req, res) => {
    const { correo, contrasena } = req.body;
    if (!textoValido(correo, 100) || !textoValido(contrasena, 100)) {
        return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
    }

    const usuario = await buscarUsuario(correo.trim().toLowerCase(), contrasena);
    if (!usuario) {
        return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    // Nueva sesión para evitar la fijación de sesión
    await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    req.session.usuario = usuario;

    res.json(await datosSesion(usuario));
});

/**
 * GET /api/auth/sesion - Sesión actual ({ rol: null } si no hay)
 */
app.get('/api/auth/sesion', async (req, res) => {
    const usuario = req.session.usuario;
    const datos = usuario ? await datosSesion(usuario) : null;

    if (usuario && !datos) {
        req.session.destroy(() => {});
    }
    res.json(datos || { rol: null });
});

/**
 * POST /api/auth/logout - Cierra la sesión
 */
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('jhw.sid');
        res.json({ message: 'Sesión cerrada' });
    });
});

// =============================================
// SOLICITUDES ESTUDIANTES (ADMISIÓN)
// =============================================
/**
 * GET /api/solicitudes_estudiantes - Lista de postulaciones (solo admin)
 */
app.get('/api/solicitudes_estudiantes', requiereSesion('admin'), async (req, res) => {
    const [solicitudes] = await pool.query('SELECT * FROM solicitudes_estudiantes');
    res.json(solicitudes);
});

/**
 * GET /api/solicitudes_estudiantes/estado?folio=ADM-123&correo=... - El postulante consulta su estado
 */
app.get('/api/solicitudes_estudiantes/estado', limiteIntentos, async (req, res) => {
    const { folio, correo } = req.query;
    if (!textoValido(folio, 20) || !textoValido(correo, 100)) {
        return res.status(400).json({ error: 'Ingresa tu folio y el correo con que postulaste' });
    }

    const [[solicitud]] = await pool.query(
        'SELECT id, nombre, anio_postulacion, estado, fecha_inscripcion FROM solicitudes_estudiantes WHERE id = ? AND correo = ?',
        [folio.trim().toUpperCase(), correo.trim()]
    );

    if (!solicitud) {
        return res.status(404).json({ error: 'No encontramos una postulación con esos datos' });
    }
    res.json(solicitud);
});

/**
 * POST /api/solicitudes_estudiantes - Nueva postulación (público)
 */
app.post('/api/solicitudes_estudiantes', limiteFormularios, async (req, res) => {
    const { nombre, fecha_nacimiento, correo, anio_postulacion, motivacion } = req.body;

    if (!textoValido(nombre, 100) || !textoValido(fecha_nacimiento, 10) || !CORREO_VALIDO.test(correo || '')
        || !ANIOS_POSTULACION.includes(anio_postulacion) || !textoValido(motivacion, 1000)) {
        return res.status(400).json({ error: 'Revisa los datos del formulario' });
    }

    const id = nuevoId('ADM-');
    await pool.query(
        'INSERT INTO solicitudes_estudiantes (id, nombre, fecha_nacimiento, correo, anio_postulacion, estado, fecha_inscripcion, motivacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, nombre.trim(), fecha_nacimiento, correo.trim(), anio_postulacion, 'En Revisión', fechaHoy(), motivacion.trim()]
    );

    res.status(201).json({ message: 'Postulación recibida correctamente', id });
});

/**
 * PUT /api/solicitudes_estudiantes/:id - Cambiar estado (solo admin)
 */
app.put('/api/solicitudes_estudiantes/:id', requiereSesion('admin'), async (req, res) => {
    const { estado } = req.body;
    if (!ESTADOS_POSTULACION.includes(estado)) {
        return res.status(400).json({ error: 'Estado no válido' });
    }

    const [result] = await pool.query('UPDATE solicitudes_estudiantes SET estado = ? WHERE id = ?', [estado, req.params.id]);
    if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    res.json({ message: 'Solicitud actualizada correctamente', id: req.params.id });
});

/**
 * DELETE /api/solicitudes_estudiantes/:id - Anular postulación (solo admin)
 */
app.delete('/api/solicitudes_estudiantes/:id', requiereSesion('admin'), async (req, res) => {
    const [result] = await pool.query('DELETE FROM solicitudes_estudiantes WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    res.json({ message: 'Solicitud eliminada correctamente' });
});

// =============================================
// CRUD: PROFESORES (solo admin)
// =============================================
/**
 * POST /api/profesores - Crear profesor (con acceso al Aula Virtual si se indica correo)
 */
app.post('/api/profesores', requiereSesion('admin'), async (req, res) => {
    const { nombre, departamento, correo, contrasena } = req.body;

    if (!textoValido(nombre, 100) || !textoValido(departamento, 100)) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    if (correo && (!CORREO_VALIDO.test(correo) || !textoValido(contrasena, 100) || contrasena.length < 6)) {
        return res.status(400).json({ error: 'Indica un correo válido y una contraseña de al menos 6 caracteres' });
    }

    const id = nuevoId('P');
    const hash = correo ? await bcrypt.hash(contrasena, 10) : null;

    try {
        await pool.query(
            'INSERT INTO profesores (id, nombre, departamento, correo, contrasena) VALUES (?, ?, ?, ?, ?)',
            [id, nombre.trim(), departamento.trim(), correo ? correo.trim().toLowerCase() : null, hash]
        );
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Ese correo ya está registrado' });
        }
        throw error;
    }

    res.status(201).json({ message: 'Profesor creado correctamente', id });
});

/**
 * PUT /api/profesores/:id - Actualizar profesor
 */
app.put('/api/profesores/:id', requiereSesion('admin'), async (req, res) => {
    const { nombre, departamento } = req.body;
    if (!textoValido(nombre, 100) || !textoValido(departamento, 100)) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const [result] = await pool.query(
        'UPDATE profesores SET nombre = ?, departamento = ? WHERE id = ?',
        [nombre.trim(), departamento.trim(), req.params.id]
    );
    if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Profesor no encontrado' });
    }
    res.json({ message: 'Profesor actualizado correctamente' });
});

// =============================================
// CRUD: ASIGNATURAS (solo admin)
// =============================================
/**
 * POST /api/asignaturas - Crear nueva asignatura
 */
app.post('/api/asignaturas', requiereSesion('admin'), async (req, res) => {
    const { codigo, nombre, profesor_id, color } = req.body;
    if (!textoValido(codigo, 20) || !textoValido(nombre, 100)) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const id = nuevoId('A');
    await pool.query(
        'INSERT INTO asignaturas (id, codigo, nombre, profesor_id, color) VALUES (?, ?, ?, ?, ?)',
        [id, codigo.trim(), nombre.trim(), profesor_id || null, color || 'primary']
    );
    res.status(201).json({ message: 'Asignatura creada correctamente', id });
});

/**
 * PUT /api/asignaturas/:id - Actualizar asignatura
 */
app.put('/api/asignaturas/:id', requiereSesion('admin'), async (req, res) => {
    const { codigo, nombre, profesor_id, color } = req.body;
    if (!textoValido(codigo, 20) || !textoValido(nombre, 100)) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const [result] = await pool.query(
        'UPDATE asignaturas SET codigo = ?, nombre = ?, profesor_id = ?, color = ? WHERE id = ?',
        [codigo.trim(), nombre.trim(), profesor_id || null, color || 'primary', req.params.id]
    );
    if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Asignatura no encontrada' });
    }
    res.json({ message: 'Asignatura actualizada correctamente' });
});

// =============================================
// CRUD: HORARIOS (solo admin)
// =============================================
/**
 * PUT /api/horarios - Asigna (o deja libre) una celda del horario según bloque y día
 */
app.put('/api/horarios', requiereSesion('admin'), async (req, res) => {
    const { bloque, dia, asignatura_id, aula } = req.body;

    if (!bloque || !dia) {
        return res.status(400).json({ error: 'Bloque y día son requeridos' });
    }

    const [result] = await pool.query(
        'UPDATE horarios SET asignatura_id = ?, aula = ? WHERE bloque = ? AND dia = ?',
        [asignatura_id || null, aula || '', bloque, dia]
    );

    // Si la celda aún no existe en la tabla, se crea
    if (result.affectedRows === 0) {
        await pool.query(
            'INSERT INTO horarios (bloque, dia, asignatura_id, aula) VALUES (?, ?, ?, ?)',
            [bloque, dia, asignatura_id || null, aula || '']
        );
    }

    res.json({ message: 'Horario actualizado correctamente' });
});

// =============================================
// SOLICITUDES PROFESORES (SOPORTE TÉCNICO)
// =============================================
/**
 * GET /api/solicitudes_profesores - El admin ve todos los tickets; el profesor, solo los suyos
 */
app.get('/api/solicitudes_profesores', requiereSesion('admin', 'profesor'), async (req, res) => {
    const usuario = req.session.usuario;
    const [tickets] = usuario.rol === 'admin'
        ? await pool.query('SELECT * FROM solicitudes_profesores')
        : await pool.query('SELECT * FROM solicitudes_profesores WHERE profesor = ?', [usuario.nombre]);
    res.json(tickets);
});

/**
 * POST /api/solicitudes_profesores - Crear ticket de soporte (profesor o admin)
 */
app.post('/api/solicitudes_profesores', requiereSesion('admin', 'profesor'), async (req, res) => {
    const usuario = req.session.usuario;
    const { ubicacion, problema, prioridad } = req.body;
    const profesor = usuario.rol === 'profesor' ? usuario.nombre : req.body.profesor;

    if (!textoValido(profesor, 100) || !textoValido(ubicacion, 100) || !textoValido(problema, 1000) || !PRIORIDADES.includes(prioridad)) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const id = nuevoId('SOP-');
    await pool.query(
        'INSERT INTO solicitudes_profesores (id, profesor, ubicacion, problema, prioridad, fecha) VALUES (?, ?, ?, ?, ?, ?)',
        [id, profesor.trim(), ubicacion.trim(), problema.trim(), prioridad, fechaHoy()]
    );
    res.status(201).json({ message: 'Solicitud de soporte creada correctamente', id });
});

/**
 * PUT /api/solicitudes_profesores/:id - Actualizar prioridad (solo admin)
 */
app.put('/api/solicitudes_profesores/:id', requiereSesion('admin'), async (req, res) => {
    const { prioridad } = req.body;
    if (!PRIORIDADES.includes(prioridad)) {
        return res.status(400).json({ error: 'Prioridad no válida' });
    }

    const [result] = await pool.query('UPDATE solicitudes_profesores SET prioridad = ? WHERE id = ?', [prioridad, req.params.id]);
    if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    res.json({ message: 'Solicitud actualizada correctamente' });
});

/**
 * DELETE /api/solicitudes_profesores/:id - Cerrar ticket resuelto (solo admin)
 */
app.delete('/api/solicitudes_profesores/:id', requiereSesion('admin'), async (req, res) => {
    const [result] = await pool.query('DELETE FROM solicitudes_profesores WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    res.json({ message: 'Solicitud eliminada correctamente' });
});

// =============================================
// ANUNCIOS AULA VIRTUAL
// =============================================
/**
 * GET /api/anuncios_aula - Anuncios publicados, del más reciente al más antiguo (público)
 */
app.get('/api/anuncios_aula', async (req, res) => {
    const [anuncios] = await pool.query('SELECT id, titulo, contenido, autor, fecha FROM anuncios_aula ORDER BY creado_en DESC');
    res.json(anuncios);
});

/**
 * POST /api/anuncios_aula - Publicar anuncio (solo admin)
 */
app.post('/api/anuncios_aula', requiereSesion('admin'), async (req, res) => {
    const { titulo, contenido, autor } = req.body;
    if (!textoValido(titulo, 100) || !textoValido(contenido, 5000) || !textoValido(autor, 100)) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const id = nuevoId('AV-');
    await pool.query(
        'INSERT INTO anuncios_aula (id, titulo, contenido, autor, fecha) VALUES (?, ?, ?, ?, ?)',
        [id, titulo.trim(), contenido.trim(), autor.trim(), fechaHoy()]
    );
    res.status(201).json({ message: 'Anuncio publicado correctamente', id });
});

/**
 * DELETE /api/anuncios_aula/:id - Eliminar anuncio (solo admin)
 */
app.delete('/api/anuncios_aula/:id', requiereSesion('admin'), async (req, res) => {
    const [result] = await pool.query('DELETE FROM anuncios_aula WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Anuncio no encontrado' });
    }
    res.json({ message: 'Anuncio eliminado correctamente' });
});

// =============================================
// RECURSOS DEL AULA VIRTUAL (libros digitales, guías, tareas, enlaces)
// =============================================
/**
 * GET /api/recursos_aula?asignatura_id=A101 - Recursos de una asignatura (con sesión)
 */
app.get('/api/recursos_aula', requiereSesion(), async (req, res) => {
    const { asignatura_id } = req.query;
    const [recursos] = asignatura_id
        ? await pool.query(`SELECT * FROM recursos_aula WHERE asignatura_id = ? ORDER BY ${ORDEN_FECHA('fecha')}`, [asignatura_id])
        : await pool.query(`SELECT * FROM recursos_aula ORDER BY ${ORDEN_FECHA('fecha')}`);
    res.json(recursos);
});

/**
 * POST /api/recursos_aula - El profesor agrega un recurso a su asignatura
 */
app.post('/api/recursos_aula', requiereSesion('admin', 'profesor'), async (req, res) => {
    const { asignatura_id, tipo, titulo, descripcion, url } = req.body;

    if (!asignatura_id || !textoValido(titulo, 150)) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    if (url && !URL_VALIDA.test(url)) {
        return res.status(400).json({ error: 'El enlace debe comenzar con http:// o https://' });
    }
    if (!await puedeGestionarAsignatura(req.session.usuario, asignatura_id)) {
        return res.status(403).json({ error: 'Solo puedes publicar en tus asignaturas' });
    }

    const id = nuevoId('REC-');
    await pool.query(
        'INSERT INTO recursos_aula (id, asignatura_id, tipo, titulo, descripcion, url, fecha) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, asignatura_id, tipo || 'documento', titulo.trim(), (descripcion || '').trim(), (url || '').trim(), fechaHoy()]
    );
    res.status(201).json({ message: 'Recurso agregado correctamente', id });
});

/**
 * Comprueba que el recurso exista y que el usuario pueda gestionarlo
 */
async function verificarRecurso(req, res) {
    const [[recurso]] = await pool.query('SELECT asignatura_id FROM recursos_aula WHERE id = ?', [req.params.id]);
    if (!recurso) {
        res.status(404).json({ error: 'Recurso no encontrado' });
        return false;
    }
    if (!await puedeGestionarAsignatura(req.session.usuario, recurso.asignatura_id)) {
        res.status(403).json({ error: 'Solo puedes modificar recursos de tus asignaturas' });
        return false;
    }
    return true;
}

/**
 * PUT /api/recursos_aula/:id - El profesor modifica un recurso ya publicado
 */
app.put('/api/recursos_aula/:id', requiereSesion('admin', 'profesor'), async (req, res) => {
    const { tipo, titulo, descripcion, url } = req.body;

    if (!textoValido(titulo, 150)) {
        return res.status(400).json({ error: 'El título es requerido' });
    }
    if (url && !URL_VALIDA.test(url)) {
        return res.status(400).json({ error: 'El enlace debe comenzar con http:// o https://' });
    }
    if (!await verificarRecurso(req, res)) return;

    await pool.query(
        'UPDATE recursos_aula SET tipo = ?, titulo = ?, descripcion = ?, url = ? WHERE id = ?',
        [tipo || 'documento', titulo.trim(), (descripcion || '').trim(), (url || '').trim(), req.params.id]
    );
    res.json({ message: 'Recurso actualizado correctamente' });
});

/**
 * DELETE /api/recursos_aula/:id - El profesor quita un recurso de su asignatura
 */
app.delete('/api/recursos_aula/:id', requiereSesion('admin', 'profesor'), async (req, res) => {
    if (!await verificarRecurso(req, res)) return;

    await pool.query('DELETE FROM recursos_aula WHERE id = ?', [req.params.id]);
    res.json({ message: 'Recurso eliminado correctamente' });
});

// =============================================
// ESTUDIANTES (lista básica para que el profesor asigne notas)
// =============================================
/**
 * GET /api/estudiantes - Lista de alumnos matriculados (sin datos de acceso)
 */
app.get('/api/estudiantes', requiereSesion('admin', 'profesor'), async (req, res) => {
    const [estudiantes] = await pool.query('SELECT id, nombre, curso FROM estudiantes ORDER BY nombre');
    res.json(estudiantes);
});

// =============================================
// CALIFICACIONES (notas por alumno y asignatura)
// =============================================
/**
 * GET /api/calificaciones?asignatura_id=A101&estudiante_id=EST-001
 * - Alumno y apoderado: solo las notas del alumno de la sesión
 * - Profesor: solo las de sus asignaturas
 * - Admin: todas
 */
app.get('/api/calificaciones', requiereSesion(), async (req, res) => {
    const usuario = req.session.usuario;
    let { asignatura_id, estudiante_id } = req.query;

    if (usuario.rol === 'alumno' || usuario.rol === 'apoderado') {
        estudiante_id = usuario.id;
    } else if (usuario.rol === 'profesor' && (!asignatura_id || !await puedeGestionarAsignatura(usuario, asignatura_id))) {
        return res.status(403).json({ error: 'Solo puedes ver las notas de tus asignaturas' });
    }

    let sql = `SELECT c.*, e.nombre AS estudiante_nombre FROM calificaciones c
                JOIN estudiantes e ON e.id = c.estudiante_id WHERE 1 = 1`;
    const params = [];

    if (asignatura_id) {
        sql += ' AND c.asignatura_id = ?';
        params.push(asignatura_id);
    }
    if (estudiante_id) {
        sql += ' AND c.estudiante_id = ?';
        params.push(estudiante_id);
    }
    sql += ` ORDER BY ${ORDEN_FECHA('c.fecha')}`;

    const [calificaciones] = await pool.query(sql, params);
    res.json(calificaciones);
});

// Escala de notas chilena: 1.0 a 7.0
const notaValida = (nota) => typeof nota === 'number' && nota >= 1 && nota <= 7;

/**
 * POST /api/calificaciones - El profesor agrega una nota en su asignatura
 */
app.post('/api/calificaciones', requiereSesion('admin', 'profesor'), async (req, res) => {
    const { estudiante_id, asignatura_id, evaluacion, nota } = req.body;

    if (!estudiante_id || !asignatura_id || !textoValido(evaluacion, 100) || !notaValida(nota)) {
        return res.status(400).json({ error: 'Completa los datos con una nota entre 1.0 y 7.0' });
    }
    if (!await puedeGestionarAsignatura(req.session.usuario, asignatura_id)) {
        return res.status(403).json({ error: 'Solo puedes poner notas en tus asignaturas' });
    }

    const id = nuevoId('CAL-');
    await pool.query(
        'INSERT INTO calificaciones (id, estudiante_id, asignatura_id, evaluacion, nota, fecha) VALUES (?, ?, ?, ?, ?, ?)',
        [id, estudiante_id, asignatura_id, evaluacion.trim(), nota, fechaHoy()]
    );
    res.status(201).json({ message: 'Nota agregada correctamente', id });
});

/**
 * Comprueba que la nota exista y que el usuario pueda gestionarla
 */
async function verificarCalificacion(req, res) {
    const [[calificacion]] = await pool.query('SELECT asignatura_id FROM calificaciones WHERE id = ?', [req.params.id]);
    if (!calificacion) {
        res.status(404).json({ error: 'Nota no encontrada' });
        return false;
    }
    if (!await puedeGestionarAsignatura(req.session.usuario, calificacion.asignatura_id)) {
        res.status(403).json({ error: 'Solo puedes modificar notas de tus asignaturas' });
        return false;
    }
    return true;
}

/**
 * PUT /api/calificaciones/:id - El profesor modifica una nota
 */
app.put('/api/calificaciones/:id', requiereSesion('admin', 'profesor'), async (req, res) => {
    const { evaluacion, nota } = req.body;

    if (!textoValido(evaluacion, 100) || !notaValida(nota)) {
        return res.status(400).json({ error: 'Completa los datos con una nota entre 1.0 y 7.0' });
    }
    if (!await verificarCalificacion(req, res)) return;

    await pool.query('UPDATE calificaciones SET evaluacion = ?, nota = ? WHERE id = ?', [evaluacion.trim(), nota, req.params.id]);
    res.json({ message: 'Nota actualizada correctamente' });
});

/**
 * DELETE /api/calificaciones/:id - El profesor elimina una nota
 */
app.delete('/api/calificaciones/:id', requiereSesion('admin', 'profesor'), async (req, res) => {
    if (!await verificarCalificacion(req, res)) return;

    await pool.query('DELETE FROM calificaciones WHERE id = ?', [req.params.id]);
    res.json({ message: 'Nota eliminada correctamente' });
});

// =============================================
// MENSAJES DE CONTACTO
// =============================================
/**
 * POST /api/contacto - Enviar mensaje desde el formulario de Contacto (público)
 */
app.post('/api/contacto', limiteFormularios, async (req, res) => {
    const { nombre, correo, asunto, mensaje } = req.body;

    if (!textoValido(nombre, 100) || !CORREO_VALIDO.test(correo || '') || !textoValido(asunto, 150) || !textoValido(mensaje, 2000)) {
        return res.status(400).json({ error: 'Revisa los datos del formulario' });
    }

    await pool.query(
        'INSERT INTO mensajes_contacto (nombre, correo, asunto, mensaje) VALUES (?, ?, ?, ?)',
        [nombre.trim(), correo.trim(), asunto.trim(), mensaje.trim()]
    );
    res.status(201).json({ message: 'Mensaje enviado correctamente' });
});

/**
 * GET /api/contacto - Mensajes recibidos (solo admin)
 */
app.get('/api/contacto', requiereSesion('admin'), async (req, res) => {
    const [mensajes] = await pool.query(
        "SELECT id, nombre, correo, asunto, mensaje, DATE_FORMAT(creado_en, '%d/%m/%Y %H:%i') AS fecha FROM mensajes_contacto ORDER BY creado_en DESC"
    );
    res.json(mensajes);
});

/**
 * DELETE /api/contacto/:id - Eliminar mensaje atendido (solo admin)
 */
app.delete('/api/contacto/:id', requiereSesion('admin'), async (req, res) => {
    const [result] = await pool.query('DELETE FROM mensajes_contacto WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Mensaje no encontrado' });
    }
    res.json({ message: 'Mensaje eliminado correctamente' });
});

// =============================================
// MANEJO DE ERRORES GLOBAL
// =============================================
app.use((err, req, res, next) => {
    console.error(`❌ Error en ${req.method} ${req.path}:`, err.message);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
        error: status === 500 ? 'Error interno del servidor. Inténtalo nuevamente.' : 'Solicitud no válida'
    });
});

// Ruta 404: JSON para la API y página propia para el resto
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Ruta no encontrada', path: req.path });
    }
    res.status(404).sendFile(path.join(__dirname, 'public', 'html', '404.html'));
});

// =============================================
// INICIAR SERVIDOR
// =============================================
app.listen(PORT, () => {
    console.log(`✅ Servidor Backend corriendo en http://localhost:${PORT}`);
    console.log(`📁 Base de datos: ${dbConfig.database}`);
    console.log(`📊 Host: ${dbConfig.host}`);
    console.log(`👤 Usuario: ${dbConfig.user}`);

    if (!process.env.SESSION_SECRET) {
        console.warn('⚠️  SESSION_SECRET no está definido en .env: las sesiones se cerrarán al reiniciar el servidor.');
    }

    // Comprobar la conexión con MySQL al iniciar
    pool.query('SELECT 1')
        .then(() => console.log('✅ Conexión con MySQL establecida'))
        .catch(error => console.error(`❌ No se pudo conectar con MySQL: ${error.message}\n   Revisa los datos del archivo .env y crea la base con "npm run db".`));
});

// Manejo de cierre graceful
process.on('SIGTERM', () => {
    console.log('📍 Señal SIGTERM recibida. Cerrando servidor...');
    pool.end();
    process.exit(0);
});
