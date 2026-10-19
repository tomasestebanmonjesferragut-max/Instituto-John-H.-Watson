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

// Roles de la directiva (tabla administradores, columna cargo)
const DIRECTIVA = ['director', 'secretaria'];

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
 * El director gestiona todas las asignaturas; el profesor solo las que tiene a cargo
 */
async function puedeGestionarAsignatura(usuario, asignaturaId) {
    if (usuario.rol === 'director') return true;
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

// Direcciones antiguas del portal (antes de unir las páginas en cuatro)
const RUTAS_ANTIGUAS = {
    'materias.html': 'academico.html#asignaturas',
    'profesores.html': 'academico.html#docentes',
    'horarios.html': 'academico.html#agenda',
    'aulaVirtual.html': 'aula.html',
    'aulaVirtualAlumnos.html': 'aula.html',
    'solicitudes.html': 'tramites.html#admision',
    'solicitudesProfesores.html': 'tramites.html#soporte',
    'informacion.html': 'index.html#nosotros',
    'contacto.html': 'index.html#contacto'
};

app.get('/html/:pagina', (req, res, next) => {
    const destino = RUTAS_ANTIGUAS[req.params.pagina];
    destino ? res.redirect(301, `/html/${destino}`) : next();
});

// =============================================
// API: INFORMACIÓN ACADÉMICA (según el rol)
// =============================================
/**
 * GET /api/resumen - Cifras públicas del instituto
 */
app.get('/api/resumen', async (req, res) => {
    const [[cifras]] = await pool.query(
        'SELECT (SELECT COUNT(*) FROM asignaturas) AS asignaturas, (SELECT COUNT(*) FROM profesores) AS docentes'
    );
    res.json(cifras);
});

/**
 * GET /api/asignaturas - Asignaturas que imparte el instituto
 * Los visitantes solo ven la materia; con sesión también se ve el docente a cargo.
 */
app.get('/api/asignaturas', async (req, res) => {
    const [asignaturas] = await pool.query(`
        SELECT a.id, a.codigo, a.nombre, a.descripcion, a.color, a.profesor_id IS NOT NULL AS tiene_docente,
               (SELECT COUNT(*) FROM horarios h WHERE h.asignatura_id = a.id) AS bloques,
               a.profesor_id, p.nombre AS profesor_nombre, p.correo AS profesor_correo
        FROM asignaturas a LEFT JOIN profesores p ON p.id = a.profesor_id
        ORDER BY a.codigo`);

    if (!req.session.usuario) {
        asignaturas.forEach(a => { delete a.profesor_id; delete a.profesor_nombre; delete a.profesor_correo; });
    }
    res.json(asignaturas);
});

/**
 * GET /api/docentes - Docentes y sus asignaturas
 * Todos los usuarios con sesión ven nombre, asignaturas y correo institucional.
 * La directiva ve la ficha completa de todos; cada profesor, solo la suya.
 */
app.get('/api/docentes', requiereSesion(), async (req, res) => {
    const usuario = req.session.usuario;
    const [docentes] = await pool.query(`
        SELECT p.id, p.nombre, p.departamento, p.correo, p.rut, p.telefono, p.correo_personal, p.horario_trabajo, p.curriculum,
               GROUP_CONCAT(a.nombre ORDER BY a.codigo SEPARATOR '||') AS asignaturas
        FROM profesores p LEFT JOIN asignaturas a ON a.profesor_id = p.id
        GROUP BY p.id ORDER BY p.nombre`);

    res.json(docentes.map(d => {
        const asignaturas = d.asignaturas ? d.asignaturas.split('||') : [];
        const fichaCompleta = DIRECTIVA.includes(usuario.rol) || (usuario.rol === 'profesor' && d.id === usuario.id);
        return fichaCompleta
            ? { ...d, asignaturas }
            : { id: d.id, nombre: d.nombre, correo: d.correo, asignaturas };
    }));
});

/**
 * GET /api/horario - Agenda semanal y avisos (solo comunidad con sesión)
 */
app.get('/api/horario', requiereSesion(), async (req, res) => {
    const [bloques] = await pool.query('SELECT bloque, dia, asignatura_id, aula FROM horarios ORDER BY bloque');
    const [avisos] = await pool.query('SELECT descripcion FROM notas');
    res.json({ bloques, avisos: avisos.map(a => a.descripcion) });
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

    const [[admin]] = await pool.query('SELECT id, nombre, contrasena, cargo FROM administradores WHERE correo = ?', [correo]);
    if (await coincide(admin, admin?.contrasena)) return { rol: DIRECTIVA.includes(admin.cargo) ? admin.cargo : 'secretaria', id: admin.id, nombre: admin.nombre };

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
    if (DIRECTIVA.includes(usuario.rol)) {
        const [[admin]] = await pool.query('SELECT id, nombre, correo FROM administradores WHERE id = ?', [usuario.id]);
        return admin ? { rol: usuario.rol, nombre: admin.nombre, admin } : null;
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
 * GET /api/solicitudes_estudiantes - Lista de postulaciones (dirección y secretaría)
 */
app.get('/api/solicitudes_estudiantes', requiereSesion(...DIRECTIVA), async (req, res) => {
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
 * PUT /api/solicitudes_estudiantes/:id - Cambiar estado (dirección y secretaría)
 */
app.put('/api/solicitudes_estudiantes/:id', requiereSesion(...DIRECTIVA), async (req, res) => {
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
 * DELETE /api/solicitudes_estudiantes/:id - Anular postulación (dirección y secretaría)
 */
app.delete('/api/solicitudes_estudiantes/:id', requiereSesion(...DIRECTIVA), async (req, res) => {
    const [result] = await pool.query('DELETE FROM solicitudes_estudiantes WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    res.json({ message: 'Solicitud eliminada correctamente' });
});

// =============================================
// CRUD: PROFESORES (solo el director)
// =============================================
// Campos opcionales de la ficha del docente
const CAMPOS_FICHA = ['rut', 'telefono', 'correo_personal', 'horario_trabajo', 'curriculum'];
const valoresFicha = (body) => CAMPOS_FICHA.map(campo => {
    const valor = typeof body[campo] === 'string' ? body[campo].trim() : '';
    return valor ? valor.slice(0, campo === 'curriculum' ? 2000 : 150) : null;
});

/**
 * POST /api/profesores - Crear profesor (con acceso al Aula Virtual si se indica correo)
 */
app.post('/api/profesores', requiereSesion('director'), async (req, res) => {
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
            'INSERT INTO profesores (id, nombre, departamento, correo, contrasena, rut, telefono, correo_personal, horario_trabajo, curriculum) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, nombre.trim(), departamento.trim(), correo ? correo.trim().toLowerCase() : null, hash, ...valoresFicha(req.body)]
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
app.put('/api/profesores/:id', requiereSesion('director'), async (req, res) => {
    const { nombre, departamento } = req.body;
    if (!textoValido(nombre, 100) || !textoValido(departamento, 100)) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const [result] = await pool.query(
        'UPDATE profesores SET nombre = ?, departamento = ?, rut = ?, telefono = ?, correo_personal = ?, horario_trabajo = ?, curriculum = ? WHERE id = ?',
        [nombre.trim(), departamento.trim(), ...valoresFicha(req.body), req.params.id]
    );
    if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Profesor no encontrado' });
    }
    res.json({ message: 'Profesor actualizado correctamente' });
});

// =============================================
// CRUD: ASIGNATURAS (directiva; el profesor edita la descripción de las suyas)
// =============================================
/**
 * POST /api/asignaturas - Crear nueva asignatura
 */
app.post('/api/asignaturas', requiereSesion(...DIRECTIVA), async (req, res) => {
    const { codigo, nombre, descripcion, profesor_id, color } = req.body;
    if (!textoValido(codigo, 20) || !textoValido(nombre, 100)) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const id = nuevoId('A');
    await pool.query(
        'INSERT INTO asignaturas (id, codigo, nombre, descripcion, profesor_id, color) VALUES (?, ?, ?, ?, ?, ?)',
        [id, codigo.trim(), nombre.trim(), (descripcion || '').trim().slice(0, 1000), profesor_id || null, color || 'primary']
    );
    res.status(201).json({ message: 'Asignatura creada correctamente', id });
});

/**
 * PUT /api/asignaturas/:id - Actualizar asignatura
 */
app.put('/api/asignaturas/:id', requiereSesion(...DIRECTIVA), async (req, res) => {
    const { codigo, nombre, descripcion, profesor_id, color } = req.body;
    if (!textoValido(codigo, 20) || !textoValido(nombre, 100)) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const [result] = await pool.query(
        'UPDATE asignaturas SET codigo = ?, nombre = ?, descripcion = ?, profesor_id = ?, color = ? WHERE id = ?',
        [codigo.trim(), nombre.trim(), (descripcion || '').trim().slice(0, 1000), profesor_id || null, color || 'primary', req.params.id]
    );
    if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Asignatura no encontrada' });
    }
    res.json({ message: 'Asignatura actualizada correctamente' });
});

/**
 * PUT /api/asignaturas/:id/descripcion - El profesor actualiza lo que se enseña en su asignatura
 */
app.put('/api/asignaturas/:id/descripcion', requiereSesion(...DIRECTIVA, 'profesor'), async (req, res) => {
    const usuario = req.session.usuario;
    if (!textoValido(req.body.descripcion, 1000)) {
        return res.status(400).json({ error: 'Escribe la descripción de la asignatura' });
    }
    if (usuario.rol === 'profesor' && !await puedeGestionarAsignatura(usuario, req.params.id)) {
        return res.status(403).json({ error: 'Solo puedes editar tus asignaturas' });
    }

    const [result] = await pool.query('UPDATE asignaturas SET descripcion = ? WHERE id = ?', [req.body.descripcion.trim(), req.params.id]);
    if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Asignatura no encontrada' });
    }
    res.json({ message: 'Descripción actualizada correctamente' });
});

// =============================================
// CRUD: HORARIOS (directiva)
// =============================================
/**
 * PUT /api/horarios - Asigna (o deja libre) una celda del horario según bloque y día
 */
app.put('/api/horarios', requiereSesion(...DIRECTIVA), async (req, res) => {
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
 * GET /api/solicitudes_profesores - La directiva ve todos los tickets; el profesor, solo los suyos
 */
app.get('/api/solicitudes_profesores', requiereSesion(...DIRECTIVA, 'profesor'), async (req, res) => {
    const usuario = req.session.usuario;
    const [tickets] = DIRECTIVA.includes(usuario.rol)
        ? await pool.query('SELECT * FROM solicitudes_profesores')
        : await pool.query('SELECT * FROM solicitudes_profesores WHERE profesor = ?', [usuario.nombre]);
    res.json(tickets);
});

/**
 * POST /api/solicitudes_profesores - Crear ticket de soporte (profesor o directiva)
 */
app.post('/api/solicitudes_profesores', requiereSesion(...DIRECTIVA, 'profesor'), async (req, res) => {
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
 * PUT /api/solicitudes_profesores/:id - Actualizar prioridad (directiva)
 */
app.put('/api/solicitudes_profesores/:id', requiereSesion(...DIRECTIVA), async (req, res) => {
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
 * DELETE /api/solicitudes_profesores/:id - Cerrar ticket resuelto (directiva)
 */
app.delete('/api/solicitudes_profesores/:id', requiereSesion(...DIRECTIVA), async (req, res) => {
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
 * POST /api/anuncios_aula - Publicar anuncio (directiva)
 */
app.post('/api/anuncios_aula', requiereSesion(...DIRECTIVA), async (req, res) => {
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
 * DELETE /api/anuncios_aula/:id - Eliminar anuncio (directiva)
 */
app.delete('/api/anuncios_aula/:id', requiereSesion(...DIRECTIVA), async (req, res) => {
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
app.post('/api/recursos_aula', requiereSesion('director', 'profesor'), async (req, res) => {
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
app.put('/api/recursos_aula/:id', requiereSesion('director', 'profesor'), async (req, res) => {
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
app.delete('/api/recursos_aula/:id', requiereSesion('director', 'profesor'), async (req, res) => {
    if (!await verificarRecurso(req, res)) return;

    await pool.query('DELETE FROM recursos_aula WHERE id = ?', [req.params.id]);
    res.json({ message: 'Recurso eliminado correctamente' });
});

// =============================================
// ESTUDIANTES
// =============================================
/**
 * GET /api/estudiantes - Alumnos matriculados (nunca incluye contraseñas)
 * Profesor: datos de contacto del alumno y su apoderado. Dirección y secretaría: ficha completa.
 */
app.get('/api/estudiantes', requiereSesion(...DIRECTIVA, 'profesor'), async (req, res) => {
    const ficha = DIRECTIVA.includes(req.session.usuario.rol) ? ', rut, fecha_nacimiento, telefono_apoderado' : '';
    const [estudiantes] = await pool.query(
        `SELECT id, nombre, curso, correo_alumno, apoderado_nombre, correo_apoderado${ficha} FROM estudiantes ORDER BY curso, nombre`
    );
    res.json(estudiantes);
});

/**
 * GET /api/panel - Pendientes de la directiva para su panel de inicio
 */
app.get('/api/panel', requiereSesion(...DIRECTIVA), async (req, res) => {
    const [[panel]] = await pool.query(`SELECT
        (SELECT COUNT(*) FROM solicitudes_estudiantes WHERE estado = 'En Revisión') AS postulaciones,
        (SELECT COUNT(*) FROM solicitudes_profesores) AS tickets,
        (SELECT COUNT(*) FROM mensajes_contacto) AS mensajes,
        (SELECT COUNT(*) FROM estudiantes) AS alumnos,
        (SELECT COUNT(*) FROM profesores) AS docentes,
        (SELECT COUNT(*) FROM asignaturas WHERE profesor_id IS NULL) AS sin_docente`);
    res.json(panel);
});

// =============================================
// CALIFICACIONES (notas por alumno y asignatura)
// =============================================
/**
 * GET /api/calificaciones?asignatura_id=A101&estudiante_id=EST-001
 * - Alumno y apoderado: solo las notas del alumno de la sesión
 * - Profesor: solo las de sus asignaturas
 * - Director: todas
 */
app.get('/api/calificaciones', requiereSesion('director', 'profesor', 'alumno', 'apoderado'), async (req, res) => {
    const usuario = req.session.usuario;
    let { asignatura_id, estudiante_id } = req.query;

    if (usuario.rol === 'alumno' || usuario.rol === 'apoderado') {
        estudiante_id = usuario.id;
    } else if (usuario.rol === 'profesor' && (!asignatura_id || !await puedeGestionarAsignatura(usuario, asignatura_id))) {
        return res.status(403).json({ error: 'Solo puedes ver las notas de tus asignaturas' });
    }

    let sql = `SELECT c.*, e.nombre AS estudiante_nombre, a.nombre AS asignatura_nombre FROM calificaciones c
                JOIN estudiantes e ON e.id = c.estudiante_id
                JOIN asignaturas a ON a.id = c.asignatura_id WHERE 1 = 1`;
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
app.post('/api/calificaciones', requiereSesion('director', 'profesor'), async (req, res) => {
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
app.put('/api/calificaciones/:id', requiereSesion('director', 'profesor'), async (req, res) => {
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
app.delete('/api/calificaciones/:id', requiereSesion('director', 'profesor'), async (req, res) => {
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
 * GET /api/contacto - Mensajes recibidos (directiva)
 */
app.get('/api/contacto', requiereSesion(...DIRECTIVA), async (req, res) => {
    const [mensajes] = await pool.query(
        "SELECT id, nombre, correo, asunto, mensaje, DATE_FORMAT(creado_en, '%d/%m/%Y %H:%i') AS fecha FROM mensajes_contacto ORDER BY creado_en DESC"
    );
    res.json(mensajes);
});

/**
 * DELETE /api/contacto/:id - Eliminar mensaje atendido (directiva)
 */
app.delete('/api/contacto/:id', requiereSesion(...DIRECTIVA), async (req, res) => {
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

// Ruta 404: JSON para la API y una página simple para el resto
const PAGINA_404 = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex">
    <title>Página no encontrada | Instituto John H. Watson</title>
    <link rel="icon" type="image/svg+xml" href="/Image/favicon.svg">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="/css/styles.css">
</head>
<body class="dark-mode">
    <main class="container pagina-404">
        <div class="codigo" aria-hidden="true">404</div>
        <h1 class="h3 fw-bold mt-3">Página no encontrada</h1>
        <p class="text-muted mb-4">La dirección que buscas no existe o fue cambiada.</p>
        <a href="/html/index.html" class="btn btn-primary px-4">Volver al inicio</a>
    </main>
</body>
</html>`;

app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Ruta no encontrada', path: req.path });
    }
    res.status(404).send(PAGINA_404);
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
