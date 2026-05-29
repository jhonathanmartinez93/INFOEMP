const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'], 
    allowedHeaders: ['Content-Type', 'Authorization'] 
}));
app.use(express.json());

// Conexión a la base de datos de Railway en la nube
const db = mysql.createConnection('mysql://root:FBlHOfBimkmuyqXlCFbamLsvWTBINTPC@kodama.proxy.rlwy.net:16648/railway');

db.connect((err) => {
    if (err) {
        console.error('❌ Error conectando a la base de datos de Railway:', err.message);
        return;
    }
    console.log('🚀 ¡Conectado con éxito a la base de datos de Railway en la nube!');
});

// Creación automática de tablas (Aseguramos la estructura correcta)
const crearTablasDeFormaAutomatica = () => {
    const tablaUsuarios = `
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    const tablaEmpleados = `
        CREATE TABLE IF NOT EXISTS employees (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            document VARCHAR(50) NOT NULL,
            employeeNumber VARCHAR(50) NOT NULL,
            celular VARCHAR(20),
            seguroMedico VARCHAR(100),
            tipoSangre VARCHAR(20),
            lugarTrabajo VARCHAR(100),
            telefonoEmpresa VARCHAR(20),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    db.query(tablaUsuarios, (err) => {
        if (err) console.error('Error creando tabla users en la nube:', err.message);
        else console.log('✅ Tabla users verificada/creada en Railway');
    });

    db.query(tablaEmpleados, (err) => {
        if (err) {
            console.error('Error creando tabla employees en la nube:', err.message);
        } else {
            console.log('✅ Tabla employees verificada/creada en Railway');
            
            // =========================================================================
            // INYECTAR LAS COLUMNAS FALTANTES SI LA TABLA YA EXISTÍA
            // =========================================================================
            const agregarSeguro = `ALTER TABLE employees ADD COLUMN IF NOT EXISTS seguroMedico VARCHAR(100);`;
            const agregarSangre = `ALTER TABLE employees ADD COLUMN IF NOT EXISTS tipoSangre VARCHAR(20);`;

            db.query(agregarSeguro, (errAlter) => {
                if (errAlter) console.error('⚠️ Nota al verificar columna seguroMedico:', errAlter.message);
                else console.log('🔹 Columna seguroMedico verificada en la base de datos');
            });

            db.query(agregarSangre, (errAlter) => {
                if (errAlter) console.error('⚠️ Nota al verificar columna tipoSangre:', errAlter.message);
                else console.log('🔹 Columna tipoSangre verificada en la base de datos');
            });
            // =========================================================================
        }
    });
};

crearTablasDeFormaAutomatica();

// Ruta para Registrarse
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'El usuario ya existe' });
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'Usuario registrado con éxito' });
        });
    } catch (e) {
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Ruta para Iniciar Sesión
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(400).json({ error: 'Usuario no encontrado' });

        const user = results[0];
        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass) return res.status(400).json({ error: 'Contraseña incorrecta' });

        const token = jwt.sign({ id: user.id }, 'secreto_super_seguro', { expiresIn: '1h' });
        res.json({ message: '¡Login exitoso!', token });
    });
});

// Middleware de verificación de Token
const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado, falta token' });
    }

    jwt.verify(token, 'secreto_super_seguro', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido o expirado' });
        }
        req.user = user; 
        next(); 
    });
};

// 1. Ruta para AGREGAR Empleado (POST) - ¡CORREGIDA!
app.post('/api/employees', verificarToken, (req, res) => {
    // Añadidos seguroMedico y tipoSangre a la extracción del cuerpo
    const { name, document, employeeNumber, celular, seguroMedico, tipoSangre, lugarTrabajo, telefonoEmpresa } = req.body;
    
    const query = 'INSERT INTO employees (name, document, employeeNumber, celular, seguroMedico, tipoSangre, lugarTrabajo, telefonoEmpresa) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    
    db.query(query, [name, document, employeeNumber, celular, seguroMedico, tipoSangre, lugarTrabajo, telefonoEmpresa], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Empleado guardado con éxito', id: result.insertId });
    });
});

// 2. Ruta para EDITAR Empleado (PUT) - ¡CORREGIDA!
app.put('/api/employees/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    // Añadidos seguroMedico y tipoSangre a la extracción del cuerpo
    const { name, document, employeeNumber, celular, seguroMedico, tipoSangre, lugarTrabajo, telefonoEmpresa } = req.body;

    const query = 'UPDATE employees SET name=?, document=?, employeeNumber=?, celular=?, seguroMedico=?, tipoSangre=?, lugarTrabajo=?, telefonoEmpresa=? WHERE id=?';
    
    db.query(query, [name, document, employeeNumber, celular, seguroMedico, tipoSangre, lugarTrabajo, telefonoEmpresa, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Empleado actualizado con éxito' });
    });
});

// 3. Ruta para LEER todos los empleados (GET)
app.get('/api/employees', verificarToken, (req, res) => {
    db.query('SELECT * FROM employees', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Ruta PÚBLICA exacta para el visor integrado
app.get('/api/share/employee/:id', (req, res) => {
    const { id } = req.params;
    
    db.query('SELECT * FROM employees WHERE id = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'Empleado no encontrado' });
        
        const emp = results[0];
        res.json({
            id: emp.id,
            name: emp.name,
            document: emp.document,
            employee_number: emp.employeeNumber,
            celular: emp.celular || 'No registrado',
            seguro_medico: emp.seguroMedico || 'No registrado',
            tipo_sangre: emp.tipoSangre || 'No registrado',
            lugar_trabajo: emp.lugarTrabajo || 'No registrado',
            telefono_empresa: emp.telefonoEmpresa || 'No registrado'
        });
    });
});

// Ruta para eliminar múltiples empleados seleccionados (POST)
app.post('/api/employees/delete-multiple', verificarToken, (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.from(ids).length) return res.status(400).json({ error: 'No se enviaron IDs' });

    db.query('DELETE FROM employees WHERE id IN (?)', [ids], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Empleados eliminados con éxito' });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor global corriendo en el puerto ${PORT}`);
});