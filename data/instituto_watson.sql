-- 1. CREAR LA BASE DE DATOS Y USARLA
CREATE DATABASE IF NOT EXISTS instituto_watson;
USE instituto_watson;

-- =======================================================
-- LIMPIEZA PREVIA (Borra las tablas si ya existen para evitar errores)
-- Se borran en orden inverso a sus relaciones para evitar conflictos
-- =======================================================
DROP TABLE IF EXISTS mensajes_contacto;
DROP TABLE IF EXISTS calificaciones;
DROP TABLE IF EXISTS recursos_aula;
DROP TABLE IF EXISTS administradores;
DROP TABLE IF EXISTS estudiantes;
DROP TABLE IF EXISTS horarios;
DROP TABLE IF EXISTS asignaturas;
DROP TABLE IF EXISTS profesores;
DROP TABLE IF EXISTS solicitudes_estudiantes;
DROP TABLE IF EXISTS solicitudes_profesores;
DROP TABLE IF EXISTS notas;
DROP TABLE IF EXISTS anuncios_aula;

-- =======================================================
-- 2. CREACIÓN DE TABLAS
-- =======================================================

-- Tabla de Profesores
CREATE TABLE profesores (
    id VARCHAR(20) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    departamento VARCHAR(100) NOT NULL,
    correo VARCHAR(100) UNIQUE,
    contrasena VARCHAR(100),
    -- Ficha del docente: solo la ven otros docentes y la directiva
    rut VARCHAR(12),
    telefono VARCHAR(20),
    correo_personal VARCHAR(100),
    horario_trabajo VARCHAR(150),
    curriculum TEXT
);

-- Tabla de Asignaturas (Se relaciona con profesores)
CREATE TABLE asignaturas (
    id VARCHAR(20) PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    profesor_id VARCHAR(20),
    color VARCHAR(20),
    FOREIGN KEY (profesor_id) REFERENCES profesores(id)
);

-- Tabla de Horarios 
CREATE TABLE horarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bloque VARCHAR(20) NOT NULL,
    dia VARCHAR(15) NOT NULL,
    asignatura_id VARCHAR(20),
    aula VARCHAR(50),
    FOREIGN KEY (asignatura_id) REFERENCES asignaturas(id)
);

-- Tabla de Solicitudes de Estudiantes
CREATE TABLE solicitudes_estudiantes (
    id VARCHAR(20) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    correo VARCHAR(100) NOT NULL,
    anio_postulacion VARCHAR(20) NOT NULL,
    estado VARCHAR(50) DEFAULT 'En Revisión',
    fecha_inscripcion VARCHAR(20),
    motivacion TEXT
);

-- Tabla de Solicitudes (Soporte Técnico) de Profesores
CREATE TABLE solicitudes_profesores (
    id VARCHAR(20) PRIMARY KEY,
    profesor VARCHAR(100) NOT NULL,
    ubicacion VARCHAR(100) NOT NULL,
    problema TEXT NOT NULL,
    prioridad VARCHAR(20) DEFAULT 'Media',
    fecha VARCHAR(20)
);

-- Tabla de Notas o Avisos
CREATE TABLE notas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    descripcion TEXT NOT NULL
);

CREATE TABLE anuncios_aula (
    id VARCHAR(20) PRIMARY KEY,
    titulo VARCHAR(100) NOT NULL,
    contenido TEXT NOT NULL,
    autor VARCHAR(100) NOT NULL,
    fecha VARCHAR(20),
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Estudiantes matriculados (portal con inicio de sesión)
-- Cada estudiante tiene su propio acceso y el de su apoderado, ambos ven la
-- misma Aula Virtual del alumno.
CREATE TABLE estudiantes (
    id VARCHAR(20) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    curso VARCHAR(20),
    correo_alumno VARCHAR(100) UNIQUE NOT NULL,
    contrasena_alumno VARCHAR(100) NOT NULL,
    apoderado_nombre VARCHAR(100),
    correo_apoderado VARCHAR(100) UNIQUE,
    contrasena_apoderado VARCHAR(100),
    -- Ficha del alumno: la ven la dirección y la secretaría
    rut VARCHAR(12),
    fecha_nacimiento DATE,
    telefono_apoderado VARCHAR(20)
);

-- Tabla de Administradores (acceso de edición al portal completo)
CREATE TABLE administradores (
    id VARCHAR(20) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(100) UNIQUE NOT NULL,
    contrasena VARCHAR(100) NOT NULL,
    -- director: ve y gestiona todo | secretaria: admisión, mensajes, anuncios, horario, asignaturas y soporte
    cargo VARCHAR(20) NOT NULL DEFAULT 'director'
);

-- Tabla de Recursos del Aula Virtual (materiales, libros digitales, enlaces,
-- tareas) que cada profesor sube a su(s) asignatura(s).
CREATE TABLE recursos_aula (
    id VARCHAR(20) PRIMARY KEY,
    asignatura_id VARCHAR(20) NOT NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'documento',
    titulo VARCHAR(150) NOT NULL,
    descripcion TEXT,
    url VARCHAR(255),
    fecha VARCHAR(20),
    FOREIGN KEY (asignatura_id) REFERENCES asignaturas(id) ON DELETE CASCADE
);

-- Tabla de Calificaciones (notas) por alumno y asignatura.
-- El profesor a cargo de la asignatura las agrega y edita.
CREATE TABLE calificaciones (
    id VARCHAR(20) PRIMARY KEY,
    estudiante_id VARCHAR(20) NOT NULL,
    asignatura_id VARCHAR(20) NOT NULL,
    evaluacion VARCHAR(100) NOT NULL,
    nota DECIMAL(3,1) NOT NULL,
    fecha VARCHAR(20),
    FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE,
    FOREIGN KEY (asignatura_id) REFERENCES asignaturas(id) ON DELETE CASCADE
);

-- Tabla de Mensajes recibidos desde el formulario de Contacto
CREATE TABLE mensajes_contacto (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(100) NOT NULL,
    asunto VARCHAR(150) NOT NULL,
    mensaje TEXT NOT NULL,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =======================================================
-- 3. INSERCIÓN DE DATOS (POBLAR LA BASE DE DATOS)
-- =======================================================

-- Insertar Profesores
-- (correo/contrasena de demostración: mismo formato para todos, clave "profe123")
-- Las contraseñas se guardan cifradas con bcrypt
INSERT INTO profesores (id, nombre, departamento, correo, contrasena, rut, telefono, correo_personal, horario_trabajo, curriculum) VALUES
('P001', 'Dr. Roberto Salazar', 'Soporte Computacional', 'roberto.salazar@jhwatson.cl', '$2b$10$wRDM47YJ/c3pCfspETLsnemmTqUCOHdj/wSw/rXgBumIYsTZuoIRS', '12.345.678-5', '+56 9 8123 4501', 'r.salazar.docente@gmail.com', 'Lunes a viernes, 08:00 a 16:30', 'Doctor en Ingeniería Informática. 18 años de experiencia en soporte de infraestructura TI; docente del instituto desde 2009.'),
('P002', 'MSc. Elena Valdés', 'Matemática y Ciencias', 'elena.valdes@jhwatson.cl', '$2b$10$wRDM47YJ/c3pCfspETLsnemmTqUCOHdj/wSw/rXgBumIYsTZuoIRS', '13.456.789-2', '+56 9 8123 4502', 'elena.valdes.mat@gmail.com', 'Lunes a jueves, 08:00 a 17:00', 'Magíster en Didáctica de la Matemática. Profesora de Matemática y Ciencias con 12 años de experiencia en enseñanza media.'),
('P003', 'Ing. Marcos Rivas', 'Conectividad y Redes', 'marcos.rivas@jhwatson.cl', '$2b$10$wRDM47YJ/c3pCfspETLsnemmTqUCOHdj/wSw/rXgBumIYsTZuoIRS', '14.567.890-1', '+56 9 8123 4503', 'marcos.rivas.redes@gmail.com', 'Martes a viernes, 09:00 a 17:30', 'Ingeniero en Redes con certificación Cisco CCNA. Trabajó 8 años como administrador de redes antes de dedicarse a la docencia.'),
('P004', 'Lic. Carmen Rojas', 'Lenguaje y Comunicación', 'carmen.rojas@jhwatson.cl', '$2b$10$wRDM47YJ/c3pCfspETLsnemmTqUCOHdj/wSw/rXgBumIYsTZuoIRS', '15.678.901-0', '+56 9 8123 4504', 'carmen.rojas.letras@gmail.com', 'Lunes a viernes, 08:00 a 14:00', 'Licenciada en Letras y Profesora de Lenguaje. Coordina el plan lector del instituto desde 2015.'),
('P005', 'Lic. Andrés Bello', 'Historia y Educación Ciudadana', 'andres.bello@jhwatson.cl', '$2b$10$wRDM47YJ/c3pCfspETLsnemmTqUCOHdj/wSw/rXgBumIYsTZuoIRS', '16.789.012-3', '+56 9 8123 4505', 'andres.bello.hist@gmail.com', 'Lunes a viernes, 08:00 a 15:30', 'Licenciado en Historia y Profesor de Historia y Formación Ciudadana. Guía el módulo de Emprendimiento y Empleabilidad.'),
('P006', 'Prof. Jorge Silva', 'Educación Física', 'jorge.silva@jhwatson.cl', '$2b$10$wRDM47YJ/c3pCfspETLsnemmTqUCOHdj/wSw/rXgBumIYsTZuoIRS', '17.890.123-4', '+56 9 8123 4506', 'jorge.silva.edf@gmail.com', 'Lunes, miércoles y viernes, 08:00 a 18:00', 'Profesor de Educación Física y entrenador de la selección de fútbol del instituto.'),
('P007', 'Ing. Daniela Torres', 'Desarrollo de Software', 'daniela.torres@jhwatson.cl', '$2b$10$wRDM47YJ/c3pCfspETLsnemmTqUCOHdj/wSw/rXgBumIYsTZuoIRS', '18.901.234-6', '+56 9 8123 4507', 'daniela.torres.dev@gmail.com', 'Lunes a viernes, 09:00 a 17:00', 'Ingeniera de Software. 6 años como desarrolladora web full stack; enseña desarrollo web y programación en Java.'),
('P008', 'Mg. Carlos Mendoza', 'Programación y Bases de Datos', 'carlos.mendoza@jhwatson.cl', '$2b$10$wRDM47YJ/c3pCfspETLsnemmTqUCOHdj/wSw/rXgBumIYsTZuoIRS', '11.234.567-8', '+56 9 8123 4508', 'carlos.mendoza.bd@gmail.com', 'Martes a viernes, 08:00 a 16:00', 'Magíster en Tecnologías de la Información. Especialista en bases de datos relacionales y SQL.'),
('P009', 'Teacher Sarah Connor', 'Inglés', 'sarah.connor@jhwatson.cl', '$2b$10$wRDM47YJ/c3pCfspETLsnemmTqUCOHdj/wSw/rXgBumIYsTZuoIRS', '19.012.345-7', '+56 9 8123 4509', 'sarah.connor.eng@gmail.com', 'Lunes a jueves, 08:00 a 15:00', 'Profesora de Inglés con certificación CELTA. Experiencia en preparación de exámenes TOEIC.');

-- Insertar Asignaturas
INSERT INTO asignaturas (id, codigo, nombre, descripcion, profesor_id, color) VALUES
('A101', 'PLC-101', 'Lenguaje y Literatura', 'Comprensión lectora, análisis de textos literarios y no literarios, y escritura de textos argumentativos.', 'P004', 'primary'),
('A102', 'PLC-201', 'Matemática', 'Álgebra, funciones, geometría y probabilidades aplicadas a la resolución de problemas.', 'P002', 'success'),
('A103', 'PLC-301', 'Historia y Geografía', 'Historia de Chile y del mundo contemporáneo, formación ciudadana y geografía regional.', 'P005', 'warning'),
('A104', 'PLC-401', 'Inglés Común', 'Comprensión auditiva y lectora, vocabulario técnico y conversación en inglés.', 'P009', 'info'),
('A105', 'PLC-501', 'Ciencias para la Ciudadanía', 'Ciencia aplicada a la vida diaria: salud, medio ambiente, tecnología y bienestar.', 'P002', 'success'),
('A106', 'PLC-601', 'Educación Física y Salud', 'Condición física, deportes colectivos y hábitos de vida saludable.', 'P006', 'danger'),
('A107', 'MOD-001', 'Módulo: Programación y BBDD', 'Modelado de datos, lenguaje SQL y programación de aplicaciones conectadas a bases de datos.', 'P008', 'dark'),
('A108', 'MOD-002', 'Módulo: Desarrollo Aplicaciones Web', 'HTML, CSS y JavaScript para crear sitios web conectados a un servidor.', 'P007', 'info'),
('A109', 'MOD-003', 'Módulo: Prog. Orientada a Objetos (Java)', 'Clases, objetos, herencia y desarrollo de aplicaciones en Java.', 'P007', 'danger'),
('A110', 'MOD-004', 'Módulo: Armado y Mantención de Equipos', 'Ensamblaje de computadores, diagnóstico de fallas y mantención preventiva.', 'P001', 'secondary'),
('A111', 'MOD-005', 'Módulo: Sistemas Operativos (Linux/Win)', 'Instalación y administración de Linux y Windows: usuarios, permisos y servicios.', 'P001', 'primary'),
('A112', 'MOD-006', 'Módulo: Instalación de Redes (Cisco)', 'Cableado estructurado, configuración de routers y switches Cisco y direccionamiento IP.', 'P003', 'warning'),
('A113', 'MOD-007', 'Módulo: Ciberseguridad Básica', 'Buenas prácticas de seguridad, contraseñas seguras, respaldos y amenazas comunes.', 'P003', 'dark'),
('A114', 'MOD-008', 'Módulo: Emprendimiento y Empleabilidad', 'Formulación de proyectos, preparación para entrevistas laborales y trabajo en equipo.', 'P005', 'success');

-- Insertar Horarios
INSERT INTO horarios (bloque, dia, asignatura_id, aula) VALUES
('08:00 - 09:30', 'lunes', 'A101', 'Sala 3B'),
('08:00 - 09:30', 'martes', 'A102', 'Sala 3B'),
('08:00 - 09:30', 'miercoles', 'A102', 'Sala 3B'),
('08:00 - 09:30', 'jueves', 'A104', 'Sala 3B'),
('08:00 - 09:30', 'viernes', 'A103', 'Sala 3B'),
('09:45 - 11:15', 'lunes', 'A101', 'Sala 3B'),
('09:45 - 11:15', 'martes', 'A107', 'Lab Computación 1'),
('09:45 - 11:15', 'miercoles', 'A109', 'Lab Computación 2'),
('09:45 - 11:15', 'jueves', 'A103', 'Sala 3B'),
('09:45 - 11:15', 'viernes', 'A107', 'Lab Computación 1'),
('12:00 - 13:30', 'lunes', 'A108', 'Lab Computación 2'),
('12:00 - 13:30', 'martes', 'A111', 'Lab Redes y SO'),
('12:00 - 13:30', 'miercoles', 'A105', 'Lab Ciencias'),
('12:00 - 13:30', 'jueves', 'A105', 'Lab Ciencias'),
('12:00 - 13:30', 'viernes', 'A104', 'Sala 3B'),
('13:45 - 15:15', 'lunes', 'A108', 'Lab Computación 2'),
('13:45 - 15:15', 'martes', 'A111', 'Lab Redes y SO'),
('13:45 - 15:15', 'miercoles', 'A112', 'Lab Redes y SO'),
('13:45 - 15:15', 'jueves', 'A112', 'Lab Redes y SO'),
('13:45 - 15:15', 'viernes', 'A114', 'Sala 3B'),
('15:45 - 17:15', 'lunes', 'A106', 'Gimnasio'),
('15:45 - 17:15', 'martes', 'A110', 'Taller Hardware'),
('15:45 - 17:15', 'miercoles', 'A106', 'Multicancha'),
('15:45 - 17:15', 'jueves', 'A113', 'Lab Redes y SO'),
('15:45 - 17:15', 'viernes', 'A110', 'Taller Hardware');

-- Insertar Solicitudes Estudiantes
INSERT INTO solicitudes_estudiantes (id, nombre, fecha_nacimiento, correo, anio_postulacion, estado, fecha_inscripcion, motivacion) VALUES
('ADM-792', 'Lucas San Martín', '2012-05-14', 'lucas.sm@gmail.com', '1° Medio', 'En Revisión', '10/03/2026', 'He escuchado que tienen muy buenos laboratorios y me gustaría aprender a programar.'),
('ADM-415', 'Valentina Rojas', '2010-11-22', 'vale.rojas22@yahoo.com', '3° Medio', 'Aceptado', '12/03/2026', 'Vengo de otro colegio y quiero especializarme en redes y telecomunicaciones.');

-- Insertar Solicitudes de Profesores (Soporte Técnico)
INSERT INTO solicitudes_profesores (id, profesor, ubicacion, problema, prioridad, fecha) VALUES
('SOP-101', 'Dr. Roberto Salazar', 'Taller Hardware', 'El proyector principal no enciende, luz parpadea en rojo.', 'Alta', '15/03/2026'),
('SOP-102', 'Lic. Carmen Rojas', 'Sala 3B', 'No hay conexión a internet en el equipo del docente.', 'Media', '16/03/2026');

-- Insertar Notas (Avisos Importantes)
INSERT INTO notas (descripcion) VALUES
('Uso obligatorio de cotona/delantal en los Módulos de Hardware e Instalación de Redes.'),
('El Módulo de Emprendimiento y Empleabilidad se evaluará con un proyecto final en noviembre.'),
('Para Educación Física (Lunes y Miércoles, último bloque) deben traer sus útiles de aseo personal.');

INSERT INTO anuncios_aula (id, titulo, contenido, autor, fecha, creado_en) VALUES
('AV-101', '¡Bienvenidos al semestre!', 'Ya está disponible el material de estudio de la primera unidad. Por favor, revisen sus correos.', 'Administración', '20/06/2026', '2026-06-20 08:00:00'),
('AV-102', 'Proceso de Admisión 2027 abierto', 'Ya puedes postular a 1° y 3° Medio para el año 2027 desde la sección Admisión del portal. Las postulaciones se revisan por orden de llegada.', 'Dirección', '01/09/2026', '2026-09-01 09:00:00'),
('AV-103', 'Feria Técnico-Profesional JHW', 'El viernes 23 de octubre los estudiantes de los módulos de Programación y Redes presentarán sus proyectos a la comunidad. ¡Los esperamos en el gimnasio desde las 10:00!', 'Coordinación TP', '05/10/2026', '2026-10-05 10:00:00'),
('AV-104', 'Importante: reunión de apoderados', 'La reunión de apoderados del segundo semestre será el jueves 29 de octubre a las 19:00 en cada sala de curso. La asistencia es obligatoria.', 'Inspectoría General', '12/10/2026', '2026-10-12 12:00:00');

-- Insertar Administrador (acceso de edición al portal)
INSERT INTO administradores (id, nombre, correo, contrasena, cargo) VALUES
('ADM-001', 'Mg. Patricio Lagos', 'admin@jhwatson.cl', '$2b$10$q4Jth7lIkL0nF7/1hhUT1.qf1otbqKab4FE6AOVCyEssyK8Z8tAKe', 'director'),
('ADM-002', 'Claudia Muñoz', 'secretaria@jhwatson.cl', '$2b$10$q4Jth7lIkL0nF7/1hhUT1.qf1otbqKab4FE6AOVCyEssyK8Z8tAKe', 'secretaria');

-- Insertar Estudiantes matriculados (portal de alumno/apoderado)
-- (contraseñas de demostración: alumno123 / apoderado123)
INSERT INTO estudiantes (id, nombre, curso, correo_alumno, contrasena_alumno, apoderado_nombre, correo_apoderado, contrasena_apoderado, rut, fecha_nacimiento, telefono_apoderado) VALUES
('EST-001', 'Valentina Rojas', '3° Medio', 'valentina.rojas@alumnos.jhwatson.cl', '$2b$10$aYbCeXIy/MI5MKsQQ99M7.L7wQUUZzy1Ehf7dGXVuu1wsw/4U/A/q', 'Marcela Fuentes', 'marcela.fuentes@apoderados.jhwatson.cl', '$2b$10$12cg07p7TcRM/ONo1Nap8epeXChayJuOLsqlc.r8neClS7/1p6h.2', '22.345.678-9', '2009-04-12', '+56 9 7111 2201'),
('EST-002', 'Lucas San Martín', '1° Medio', 'lucas.sanmartin@alumnos.jhwatson.cl', '$2b$10$aYbCeXIy/MI5MKsQQ99M7.L7wQUUZzy1Ehf7dGXVuu1wsw/4U/A/q', 'Pedro San Martín', 'pedro.sanmartin@apoderados.jhwatson.cl', '$2b$10$12cg07p7TcRM/ONo1Nap8epeXChayJuOLsqlc.r8neClS7/1p6h.2', '23.456.789-0', '2011-08-03', '+56 9 7111 2202'),
('EST-003', 'Sofía Muñoz', '2° Medio', 'sofia.munoz@alumnos.jhwatson.cl', '$2b$10$aYbCeXIy/MI5MKsQQ99M7.L7wQUUZzy1Ehf7dGXVuu1wsw/4U/A/q', 'Andrea Pérez', 'andrea.perez@apoderados.jhwatson.cl', '$2b$10$12cg07p7TcRM/ONo1Nap8epeXChayJuOLsqlc.r8neClS7/1p6h.2', '22.987.654-3', '2010-02-21', '+56 9 7111 2203'),
('EST-004', 'Matías González', '4° Medio', 'matias.gonzalez@alumnos.jhwatson.cl', '$2b$10$aYbCeXIy/MI5MKsQQ99M7.L7wQUUZzy1Ehf7dGXVuu1wsw/4U/A/q', 'Jorge González', 'jorge.gonzalez@apoderados.jhwatson.cl', '$2b$10$12cg07p7TcRM/ONo1Nap8epeXChayJuOLsqlc.r8neClS7/1p6h.2', '21.876.543-2', '2008-11-30', '+56 9 7111 2204'),
('EST-005', 'Isidora Castro', '3° Medio', 'isidora.castro@alumnos.jhwatson.cl', '$2b$10$aYbCeXIy/MI5MKsQQ99M7.L7wQUUZzy1Ehf7dGXVuu1wsw/4U/A/q', 'Paula Reyes', 'paula.reyes@apoderados.jhwatson.cl', '$2b$10$12cg07p7TcRM/ONo1Nap8epeXChayJuOLsqlc.r8neClS7/1p6h.2', '22.765.432-1', '2009-07-15', '+56 9 7111 2205'),
('EST-006', 'Benjamín Herrera', '1° Medio', 'benjamin.herrera@alumnos.jhwatson.cl', '$2b$10$aYbCeXIy/MI5MKsQQ99M7.L7wQUUZzy1Ehf7dGXVuu1wsw/4U/A/q', 'Rodrigo Herrera', 'rodrigo.herrera@apoderados.jhwatson.cl', '$2b$10$12cg07p7TcRM/ONo1Nap8epeXChayJuOLsqlc.r8neClS7/1p6h.2', '23.654.321-5', '2011-05-09', '+56 9 7111 2206');

-- Insertar Recursos del Aula Virtual (libros digitales, guías, enlaces, tareas)
INSERT INTO recursos_aula (id, asignatura_id, tipo, titulo, descripcion, url, fecha) VALUES
('REC-001', 'A101', 'libro', 'Lengua y Literatura 3° Medio - Texto del Estudiante', 'Libro digital oficial del MINEDUC para el año en curso.', 'https://www.curriculumnacional.cl/', '01/03/2026'),
('REC-002', 'A101', 'documento', 'Guía: Análisis de textos narrativos', 'Guía de trabajo para la unidad 1.', 'https://drive.google.com/', '05/03/2026'),
('REC-003', 'A102', 'libro', 'Matemática 3° Medio - Texto del Estudiante', 'Libro digital oficial del MINEDUC.', 'https://www.curriculumnacional.cl/', '01/03/2026'),
('REC-004', 'A102', 'tarea', 'Tarea: Ecuaciones cuadráticas', 'Resolver los ejercicios 1 al 20 de la guía. Entrega el viernes.', '', '10/03/2026'),
('REC-005', 'A107', 'video', 'Introducción a bases de datos relacionales', 'Video de apoyo para la primera unidad del módulo.', 'https://www.youtube.com/', '03/03/2026'),
('REC-006', 'A107', 'enlace', 'Plataforma de práctica SQL online', 'Sitio recomendado para practicar consultas SQL.', 'https://sqlzoo.net/', '03/03/2026');

-- Insertar Calificaciones de ejemplo
INSERT INTO calificaciones (id, estudiante_id, asignatura_id, evaluacion, nota, fecha) VALUES
('CAL-001', 'EST-001', 'A101', 'Prueba: Análisis de textos', 6.2, '20/03/2026'),
('CAL-002', 'EST-001', 'A102', 'Control N°1', 5.5, '18/03/2026'),
('CAL-003', 'EST-002', 'A101', 'Prueba: Análisis de textos', 5.8, '20/03/2026');
