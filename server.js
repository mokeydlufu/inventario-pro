const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

const pool = mysql.createPool({
  host:     process.env.MYSQL_HOST     || 'db',
  user:     process.env.MYSQL_USER     || 'root',
  password: process.env.MYSQL_PASSWORD || 'root',
  database: process.env.MYSQL_DATABASE || 'inventory_db',
  port:     process.env.MYSQL_PORT     || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function initDB() {
  try {
    const connection = await pool.getConnection();
    
    // Crear tabla de usuarios
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fullName VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Crear tabla de productos (si no existe)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        quantity INT NOT NULL DEFAULT 0,
        price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    connection.release();
    console.log("Tablas inicializadas. Sistema listo.");
  } catch (err) {
    console.error("Esperando a la base de datos...", err.message);
  }
}
setTimeout(initDB, 3000);

// --- ENDPOINTS DE AUTENTICACION ---

app.post('/api/register', async (req, res) => {
  const { fullName, email, password } = req.body;
  try {
    const [result] = await pool.query('INSERT INTO users (fullName, email, password) VALUES (?, ?, ?)', [fullName, email, password]);
    res.json({ success: true, message: "Usuario registrado con éxito" });
  } catch (err) {
    res.status(400).json({ success: false, error: "El correo ya está registrado o hay un error" });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
    if (rows.length > 0) {
      res.json({ success: true, user: rows[0] });
    } else {
      res.status(401).json({ success: false, error: "Credenciales inválidas" });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- ENDPOINTS DE USUARIOS ---

app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, fullName, email, created_at FROM users ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ENDPOINTS DEL INVENTARIO ---

app.get('/api/items', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM items ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/items', async (req, res) => {
  const { name, quantity, price } = req.body;
  try {
    const [result] = await pool.query('INSERT INTO items (name, quantity, price) VALUES (?, ?, ?)', [name, quantity, price]);
    res.json({ id: result.insertId, name, quantity, price });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/items/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM items WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
