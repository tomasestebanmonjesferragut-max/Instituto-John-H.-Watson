/**
 * Servidor Backend - Aula Virtual
 * Archivo: server.js
 * Descripción: API REST para gestión de anuncios, asignaturas, profesores y solicitudes
 * Versión: 1.0.0
 * Autor: Instituto John H. Watson
 * Fecha: 2026
 */

'use strict';

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

// Cargar variables de entorno desde .env (si existe)
try { process.loadEnvFile(path.join(__dirname, '.env')); } catch (error) { /* sin .env se usan los valores por defecto */ }

// =============================================
// INICIALIZACIÓN DE EXPRESS
// =============================================
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

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
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Crear pool de conexiones
const pool = mysql.createPool(dbConfig);

// Middleware para manejo de errores de conexión
app.use((req, res, next) => {
    req.db = pool;
    next();
});

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
// API: LECTURA GLOBAL DE BASE DE DATOS
// =============================================
/**
 * GET /api/db - Obtiene todos los datos de la base de datos
 * Retorna: profesores, asignaturas, horarios, solicitudes, anuncios y notas
 */
app.get('/api/db', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        
        // Queries paralelas para mejor rendimiento
        const [profesores] = await connection.query('SELECT id, nombre, departamento FROM profesores');
        const [asignaturas] = await connection.query('SELECT id, codigo, nombre, profesor_id, color FROM asignaturas');
        const [horarios] = await connection.query('SELECT * FROM horarios');
        const [solicitudes_estudiantes] = await connection.query('SELECT * FROM solicitudes_estudiantes');
        const [solicitudes_profesores] = await connection.query('SELECT * FROM solicitudes_profesores');
        const [anuncios_aula] = await connection.query('SELECT * FROM anuncios_aula ORDER BY fecha DESC');
        const [notasRows] = await connection.query('SELECT descripcion FROM notas');
        
        const notas = notasRows.map(n => n.descripcion);
        
        res.json({
            profesores,
            asignaturas,
            horarios,
            solicitudes_estudiantes,
            solicitudes_profesores,
            anuncios_aula,
            notas,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error en /api/db:', error.message);
        res.status(500).json({ 
            error: 'Error al conectar con MySQL',
            message: error.message 
        });
    } finally {
        if (connection) connection.release();
    }
});

// =============================================
// CRUD: SOLICITUDES ESTUDIANTES
// =============================================
/**
 * POST /api/solicitudes_estudiantes - Crear nueva solicitud
 */
app.post('/api/solicitudes_estudiantes', async (req, res) => {
    const { id, nombre, fecha_nacimiento, correo, anio_postulacion, estado, fecha, motivacion } = req.body;
    
    // Validación básica
    if (!id || !nombre || !correo) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query(
            'INSERT INTO solicitudes_estudiantes (id, nombre, fecha_nacimiento, correo, anio_postulacion, estado, fecha_inscripcion, motivacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, nombre, fecha_nacimiento, correo, anio_postulacion, estado || 'pendiente', fecha, motivacion]
        );
        
        res.status(201).json({ 
            message: 'Solicitud creada correctamente',
            id: id
        });
    } catch (error) {
        console.error('❌ Error en POST /api/solicitudes_estudiantes:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * PUT /api/solicitudes_estudiantes/:id - Actualizar solicitud
 */
app.put('/api/solicitudes_estudiantes/:id', async (req, res) => {
    const { estado } = req.body;
    const { id } = req.params;
    
    if (!estado) {
        return res.status(400).json({ error: 'El estado es requerido' });
    }
    
    let connection;
    try {
        connection = await pool.getConnection();
        const result = await connection.query(
            'UPDATE solicitudes_estudiantes SET estado = ? WHERE id = ?',
            [estado, id]
        );
        
        if (result[0].affectedRows === 0) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }
        
        res.json({ 
            message: 'Solicitud actualizada correctamente',
            id: id
        });
    } catch (error) {
        console.error('❌ Error en PUT /api/solicitudes_estudiantes:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * DELETE /api/solicitudes_estudiantes/:id - Eliminar solicitud
 */
app.delete('/api/solicitudes_estudiantes/:id', async (req, res) => {
    const { id } = req.params;
    
    let connection;
    try {
        connection = await pool.getConnection();
        const result = await connection.query(
            'DELETE FROM solicitudes_estudiantes WHERE id = ?',
            [id]
        );
        
        if (result[0].affectedRows === 0) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }
        
        res.json({ message: 'Solicitud eliminada correctamente' });
    } catch (error) {
        console.error('❌ Error en DELETE /api/solicitudes_estudiantes:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// =============================================
// CRUD: PROFESORES
// =============================================
/**
 * POST /api/profesores - Crear nuevo profesor
 */
app.post('/api/profesores', async (req, res) => {
    const { id, nombre, departamento } = req.body;
    
    if (!id || !nombre || !departamento) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query(
            'INSERT INTO profesores (id, nombre, departamento) VALUES (?, ?, ?)',
            [id, nombre, departamento]
        );
        
        res.status(201).json({ 
            message: 'Profesor creado correctamente',
            id: id
        });
    } catch (error) {
        console.error('❌ Error en POST /api/profesores:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * PUT /api/profesores/:id - Actualizar profesor
 */
app.put('/api/profesores/:id', async (req, res) => {
    const { nombre, departamento } = req.body;
    const { id } = req.params;
    
    if (!nombre || !departamento) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    
    let connection;
    try {
        connection = await pool.getConnection();
        const result = await connection.query(
            'UPDATE profesores SET nombre = ?, departamento = ? WHERE id = ?',
            [nombre, departamento, id]
        );
        
        if (result[0].affectedRows === 0) {
            return res.status(404).json({ error: 'Profesor no encontrado' });
        }
        
        res.json({ message: 'Profesor actualizado correctamente' });
    } catch (error) {
        console.error('❌ Error en PUT /api/profesores:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// =============================================
// CRUD: ASIGNATURAS
// =============================================
/**
 * POST /api/asignaturas - Crear nueva asignatura
 */
app.post('/api/asignaturas', async (req, res) => {
    const { id, codigo, nombre, profesor_id, color } = req.body;
    
    if (!id || !codigo || !nombre) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query(
            'INSERT INTO asignaturas (id, codigo, nombre, profesor_id, color) VALUES (?, ?, ?, ?, ?)',
            [id, codigo, nombre, profesor_id || null, color || 'primary']
        );
        
        res.status(201).json({ 
            message: 'Asignatura creada correctamente',
            id: id
        });
    } catch (error) {
        console.error('❌ Error en POST /api/asignaturas:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * PUT /api/asignaturas/:id - Actualizar asignatura
 */
app.put('/api/asignaturas/:id', async (req, res) => {
    const { codigo, nombre, profesor_id, color } = req.body;
    const { id } = req.params;
    
    if (!codigo || !nombre) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const result = await connection.query(
            'UPDATE asignaturas SET codigo = ?, nombre = ?, profesor_id = ?, color = ? WHERE id = ?',
            [codigo, nombre, profesor_id || null, color || 'primary', id]
        );
        
        if (result[0].affectedRows === 0) {
            return res.status(404).json({ error: 'Asignatura no encontrada' });
        }
        
        res.json({ message: 'Asignatura actualizada correctamente' });
    } catch (error) {
        console.error('❌ Error en PUT /api/asignaturas:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// =============================================
// CRUD: HORARIOS
// =============================================
/**
 * PUT /api/horarios - Asigna (o deja libre) una celda del horario según bloque y día
 */
app.put('/api/horarios', async (req, res) => {
    const { bloque, dia, asignatura_id, aula } = req.body;

    if (!bloque || !dia) {
        return res.status(400).json({ error: 'Bloque y día son requeridos' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const result = await connection.query(
            'UPDATE horarios SET asignatura_id = ?, aula = ? WHERE bloque = ? AND dia = ?',
            [asignatura_id || null, aula || '', bloque, dia]
        );

        // Si la celda aún no existe en la tabla, se crea
        if (result[0].affectedRows === 0) {
            await connection.query(
                'INSERT INTO horarios (bloque, dia, asignatura_id, aula) VALUES (?, ?, ?, ?)',
                [bloque, dia, asignatura_id || null, aula || '']
            );
        }

        res.json({ message: 'Horario actualizado correctamente' });
    } catch (error) {
        console.error('❌ Error en PUT /api/horarios:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// =============================================
// CRUD: SOLICITUDES PROFESORES
// =============================================
/**
 * POST /api/solicitudes_profesores - Crear solicitud de soporte
 */
app.post('/api/solicitudes_profesores', async (req, res) => {
    const { id, profesor, ubicacion, problema, prioridad, fecha } = req.body;
    
    if (!id || !profesor || !ubicacion || !problema) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query(
            'INSERT INTO solicitudes_profesores (id, profesor, ubicacion, problema, prioridad, fecha) VALUES (?, ?, ?, ?, ?, ?)',
            [id, profesor, ubicacion, problema, prioridad || 'media', fecha]
        );
        
        res.status(201).json({ 
            message: 'Solicitud de soporte creada correctamente',
            id: id
        });
    } catch (error) {
        console.error('❌ Error en POST /api/solicitudes_profesores:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * PUT /api/solicitudes_profesores/:id - Actualizar prioridad
 */
app.put('/api/solicitudes_profesores/:id', async (req, res) => {
    const { prioridad } = req.body;
    const { id } = req.params;
    
    if (!prioridad) {
        return res.status(400).json({ error: 'La prioridad es requerida' });
    }
    
    let connection;
    try {
        connection = await pool.getConnection();
        const result = await connection.query(
            'UPDATE solicitudes_profesores SET prioridad = ? WHERE id = ?',
            [prioridad, id]
        );
        
        if (result[0].affectedRows === 0) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }
        
        res.json({ message: 'Solicitud actualizada correctamente' });
    } catch (error) {
        console.error('❌ Error en PUT /api/solicitudes_profesores:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * DELETE /api/solicitudes_profesores/:id - Eliminar solicitud
 */
app.delete('/api/solicitudes_profesores/:id', async (req, res) => {
    const { id } = req.params;
    
    let connection;
    try {
        connection = await pool.getConnection();
        const result = await connection.query(
            'DELETE FROM solicitudes_profesores WHERE id = ?',
            [id]
        );
        
        if (result[0].affectedRows === 0) {
            return res.status(404).json({ error: 'Solicitud no encontrada' });
        }
        
        res.json({ message: 'Solicitud eliminada correctamente' });
    } catch (error) {
        console.error('❌ Error en DELETE /api/solicitudes_profesores:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// =============================================
// CRUD: ANUNCIOS AULA VIRTUAL
// =============================================
/**
 * GET /api/anuncios_aula - Obtener todos los anuncios
 */
app.get('/api/anuncios_aula', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [anuncios] = await connection.query(
            'SELECT * FROM anuncios_aula ORDER BY fecha DESC'
        );
        
        res.json(anuncios);
    } catch (error) {
        console.error('❌ Error en GET /api/anuncios_aula:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * POST /api/anuncios_aula - Crear nuevo anuncio
 */
app.post('/api/anuncios_aula', async (req, res) => {
    const { id, titulo, contenido, autor, fecha } = req.body;
    
    if (!id || !titulo || !contenido || !autor) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query(
            'INSERT INTO anuncios_aula (id, titulo, contenido, autor, fecha) VALUES (?, ?, ?, ?, ?)',
            [id, titulo, contenido, autor, fecha || new Date().toISOString()]
        );
        
        res.status(201).json({ 
            message: 'Anuncio publicado correctamente',
            id: id
        });
    } catch (error) {
        console.error('❌ Error en POST /api/anuncios_aula:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * DELETE /api/anuncios_aula/:id - Eliminar anuncio
 */
app.delete('/api/anuncios_aula/:id', async (req, res) => {
    const { id } = req.params;
    
    let connection;
    try {
        connection = await pool.getConnection();
        const result = await connection.query(
            'DELETE FROM anuncios_aula WHERE id = ?',
            [id]
        );
        
        if (result[0].affectedRows === 0) {
            return res.status(404).json({ error: 'Anuncio no encontrado' });
        }
        
        res.json({ message: 'Anuncio eliminado correctamente' });
    } catch (error) {
        console.error('❌ Error en DELETE /api/anuncios_aula:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// =============================================
// AUTENTICACIÓN: PORTAL AULA VIRTUAL (alumno / apoderado / profesor)
// =============================================
/**
 * POST /api/auth/login - Login único del Aula Virtual: detecta automáticamente
 * si las credenciales corresponden a un administrador, profesor, alumno o
 * apoderado (en ese orden) y responde con el rol correspondiente.
 */
app.post('/api/auth/login', async (req, res) => {
    const { correo, contrasena } = req.body;
    if (!correo || !contrasena) {
        return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
    }

    let connection;
    try {
        connection = await pool.getConnection();

        const [admins] = await connection.query(
            'SELECT id, nombre, correo FROM administradores WHERE correo = ? AND contrasena = ?',
            [correo, contrasena]
        );
        if (admins.length > 0) {
            return res.json({ rol: 'admin', admin: admins[0] });
        }

        const [profesores] = await connection.query(
            'SELECT id, nombre, departamento FROM profesores WHERE correo = ? AND contrasena = ?',
            [correo, contrasena]
        );
        if (profesores.length > 0) {
            const profesor = profesores[0];
            const [asignaturas] = await connection.query(
                'SELECT id, codigo, nombre, color FROM asignaturas WHERE profesor_id = ?',
                [profesor.id]
            );
            return res.json({ rol: 'profesor', profesor, asignaturas });
        }

        const [alumnos] = await connection.query(
            'SELECT id, nombre, curso FROM estudiantes WHERE correo_alumno = ? AND contrasena_alumno = ?',
            [correo, contrasena]
        );
        if (alumnos.length > 0) {
            return res.json({ rol: 'alumno', estudiante: alumnos[0] });
        }

        const [apoderados] = await connection.query(
            'SELECT id, nombre, curso, apoderado_nombre FROM estudiantes WHERE correo_apoderado = ? AND contrasena_apoderado = ?',
            [correo, contrasena]
        );
        if (apoderados.length > 0) {
            return res.json({ rol: 'apoderado', estudiante: apoderados[0] });
        }

        res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    } catch (error) {
        console.error('❌ Error en POST /api/auth/login:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * POST /api/auth/admin - Login del administrador (acceso de edición del portal)
 */
app.post('/api/auth/admin', async (req, res) => {
    const { correo, contrasena } = req.body;
    if (!correo || !contrasena) {
        return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.query(
            'SELECT id, nombre, correo FROM administradores WHERE correo = ? AND contrasena = ?',
            [correo, contrasena]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
        }

        res.json({ rol: 'admin', admin: rows[0] });
    } catch (error) {
        console.error('❌ Error en POST /api/auth/admin:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * POST /api/auth/alumno - Login del alumno con su correo institucional
 */
app.post('/api/auth/alumno', async (req, res) => {
    const { correo, contrasena } = req.body;
    if (!correo || !contrasena) {
        return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.query(
            'SELECT id, nombre, curso FROM estudiantes WHERE correo_alumno = ? AND contrasena_alumno = ?',
            [correo, contrasena]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
        }

        res.json({ rol: 'alumno', estudiante: rows[0] });
    } catch (error) {
        console.error('❌ Error en POST /api/auth/estudiante:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * POST /api/auth/apoderado - Login del apoderado; retorna el aula del alumno asociado
 */
app.post('/api/auth/apoderado', async (req, res) => {
    const { correo, contrasena } = req.body;
    if (!correo || !contrasena) {
        return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.query(
            'SELECT id, nombre, curso, apoderado_nombre FROM estudiantes WHERE correo_apoderado = ? AND contrasena_apoderado = ?',
            [correo, contrasena]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
        }

        res.json({ rol: 'apoderado', estudiante: rows[0] });
    } catch (error) {
        console.error('❌ Error en POST /api/auth/apoderado:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * POST /api/auth/profesor - Login del profesor; retorna sus asignaturas a cargo
 */
app.post('/api/auth/profesor', async (req, res) => {
    const { correo, contrasena } = req.body;
    if (!correo || !contrasena) {
        return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.query(
            'SELECT id, nombre, departamento FROM profesores WHERE correo = ? AND contrasena = ?',
            [correo, contrasena]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
        }

        const profesor = rows[0];
        const [asignaturas] = await connection.query(
            'SELECT id, codigo, nombre, color FROM asignaturas WHERE profesor_id = ?',
            [profesor.id]
        );

        res.json({ rol: 'profesor', profesor, asignaturas });
    } catch (error) {
        console.error('❌ Error en POST /api/auth/profesor:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// =============================================
// CRUD: RECURSOS DEL AULA VIRTUAL (libros digitales, guías, tareas, enlaces)
// =============================================
/**
 * GET /api/recursos_aula?asignatura_id=A101 - Lista los recursos de una asignatura
 */
app.get('/api/recursos_aula', async (req, res) => {
    const { asignatura_id } = req.query;

    let connection;
    try {
        connection = await pool.getConnection();
        const [recursos] = asignatura_id
            ? await connection.query('SELECT * FROM recursos_aula WHERE asignatura_id = ? ORDER BY fecha DESC', [asignatura_id])
            : await connection.query('SELECT * FROM recursos_aula ORDER BY fecha DESC');

        res.json(recursos);
    } catch (error) {
        console.error('❌ Error en GET /api/recursos_aula:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * POST /api/recursos_aula - El profesor agrega un recurso a su asignatura
 */
app.post('/api/recursos_aula', async (req, res) => {
    const { id, asignatura_id, tipo, titulo, descripcion, url, fecha } = req.body;

    if (!id || !asignatura_id || !titulo) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query(
            'INSERT INTO recursos_aula (id, asignatura_id, tipo, titulo, descripcion, url, fecha) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, asignatura_id, tipo || 'documento', titulo, descripcion || '', url || '', fecha || new Date().toISOString()]
        );

        res.status(201).json({ message: 'Recurso agregado correctamente', id });
    } catch (error) {
        console.error('❌ Error en POST /api/recursos_aula:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * PUT /api/recursos_aula/:id - El profesor modifica un recurso ya publicado
 */
app.put('/api/recursos_aula/:id', async (req, res) => {
    const { id } = req.params;
    const { tipo, titulo, descripcion, url } = req.body;

    if (!titulo) {
        return res.status(400).json({ error: 'El título es requerido' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const result = await connection.query(
            'UPDATE recursos_aula SET tipo = ?, titulo = ?, descripcion = ?, url = ? WHERE id = ?',
            [tipo || 'documento', titulo, descripcion || '', url || '', id]
        );

        if (result[0].affectedRows === 0) {
            return res.status(404).json({ error: 'Recurso no encontrado' });
        }

        res.json({ message: 'Recurso actualizado correctamente' });
    } catch (error) {
        console.error('❌ Error en PUT /api/recursos_aula:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * DELETE /api/recursos_aula/:id - El profesor quita un recurso de su asignatura
 */
app.delete('/api/recursos_aula/:id', async (req, res) => {
    const { id } = req.params;

    let connection;
    try {
        connection = await pool.getConnection();
        const result = await connection.query('DELETE FROM recursos_aula WHERE id = ?', [id]);

        if (result[0].affectedRows === 0) {
            return res.status(404).json({ error: 'Recurso no encontrado' });
        }

        res.json({ message: 'Recurso eliminado correctamente' });
    } catch (error) {
        console.error('❌ Error en DELETE /api/recursos_aula:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// =============================================
// ESTUDIANTES (lista básica para que el profesor asigne notas)
// =============================================
/**
 * GET /api/estudiantes - Lista de alumnos matriculados (sin datos de acceso)
 */
app.get('/api/estudiantes', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [estudiantes] = await connection.query('SELECT id, nombre, curso FROM estudiantes ORDER BY nombre');
        res.json(estudiantes);
    } catch (error) {
        console.error('❌ Error en GET /api/estudiantes:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// =============================================
// CRUD: CALIFICACIONES (notas por alumno y asignatura)
// =============================================
/**
 * GET /api/calificaciones?asignatura_id=A101&estudiante_id=EST-001 - Lista notas (filtros opcionales)
 */
app.get('/api/calificaciones', async (req, res) => {
    const { asignatura_id, estudiante_id } = req.query;

    let connection;
    try {
        connection = await pool.getConnection();

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
        sql += ' ORDER BY c.fecha DESC';

        const [calificaciones] = await connection.query(sql, params);
        res.json(calificaciones);
    } catch (error) {
        console.error('❌ Error en GET /api/calificaciones:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * POST /api/calificaciones - El profesor agrega una nota
 */
app.post('/api/calificaciones', async (req, res) => {
    const { id, estudiante_id, asignatura_id, evaluacion, nota, fecha } = req.body;

    if (!id || !estudiante_id || !asignatura_id || !evaluacion || nota === undefined || nota === null) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query(
            'INSERT INTO calificaciones (id, estudiante_id, asignatura_id, evaluacion, nota, fecha) VALUES (?, ?, ?, ?, ?, ?)',
            [id, estudiante_id, asignatura_id, evaluacion, nota, fecha || new Date().toLocaleDateString('es-CL')]
        );

        res.status(201).json({ message: 'Nota agregada correctamente', id });
    } catch (error) {
        console.error('❌ Error en POST /api/calificaciones:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * PUT /api/calificaciones/:id - El profesor modifica una nota
 */
app.put('/api/calificaciones/:id', async (req, res) => {
    const { id } = req.params;
    const { evaluacion, nota } = req.body;

    if (!evaluacion || nota === undefined || nota === null) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const result = await connection.query(
            'UPDATE calificaciones SET evaluacion = ?, nota = ? WHERE id = ?',
            [evaluacion, nota, id]
        );

        if (result[0].affectedRows === 0) {
            return res.status(404).json({ error: 'Nota no encontrada' });
        }

        res.json({ message: 'Nota actualizada correctamente' });
    } catch (error) {
        console.error('❌ Error en PUT /api/calificaciones:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * DELETE /api/calificaciones/:id - El profesor elimina una nota
 */
app.delete('/api/calificaciones/:id', async (req, res) => {
    const { id } = req.params;

    let connection;
    try {
        connection = await pool.getConnection();
        const result = await connection.query('DELETE FROM calificaciones WHERE id = ?', [id]);

        if (result[0].affectedRows === 0) {
            return res.status(404).json({ error: 'Nota no encontrada' });
        }

        res.json({ message: 'Nota eliminada correctamente' });
    } catch (error) {
        console.error('❌ Error en DELETE /api/calificaciones:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// =============================================
// MANEJO DE ERRORES GLOBAL
// =============================================
app.use((err, req, res, next) => {
    console.error('❌ Error no capturado:', err.message);
    res.status(err.status || 500).json({
        error: 'Error interno del servidor',
        message: err.message
    });
});

// Ruta 404
app.use((req, res) => {
    res.status(404).json({
        error: 'Ruta no encontrada',
        path: req.path
    });
});

// =============================================
// INICIAR SERVIDOR
// =============================================
app.listen(PORT, () => {
    console.log(`✅ Servidor Backend corriendo en http://localhost:${PORT}`);
    console.log(`📁 Base de datos: ${dbConfig.database}`);
    console.log(`📊 Host: ${dbConfig.host}`);
    console.log(`👤 Usuario: ${dbConfig.user}`);

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