/**
 * Crea la base de datos instituto_watson a partir de data/instituto_watson.sql
 * Uso: npm run db
 */

'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

try { process.loadEnvFile(path.join(__dirname, '.env')); } catch (error) { /* sin .env se usan los valores por defecto */ }

(async () => {
    const sql = fs.readFileSync(path.join(__dirname, 'data', 'instituto_watson.sql'), 'utf8');

    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD ?? 'root',
            multipleStatements: true
        });

        await connection.query(sql);
        console.log('✅ Base de datos instituto_watson creada con sus datos de ejemplo');
    } catch (error) {
        console.error('❌ Error al crear la base de datos:', error.message);
        process.exitCode = 1;
    } finally {
        if (connection) await connection.end();
    }
})();
