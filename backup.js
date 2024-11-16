const express = require('express');
const multer = require('multer');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json()); // For parsing JSON body


// PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'local_community',
  password: 'ghost123',
  port: 5432, // Default PostgreSQL port
});

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true }); // Ensure the directory exists
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname)); // Append original file extension
  }
});

const upload = multer({ storage: storage });


// Route for image upload and data insertion
app.post('/register', upload.single('photo'), async (req, res) => {
  try {
    const { uname, email, unumber, country, city, address, upassword } = req.body;
    const imagePath = req.file ? req.file.path : null; // Get the file path from multer

    // Insert data into PostgreSQL
    const query = `
      INSERT INTO users (uname, email, unumber, country, city, address, upassword, photo_path)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [uname, email, unumber, country, city, address, upassword, imagePath];

    const result = await pool.query(query, values);
    res.status(201).send(`User registered successfully: ID ${result.rows[0].id}`);
  } catch (error) {
    console.error('Error inserting data:', error);
    res.status(500).send('Error registering user');
  }
});


// Check for user login credentials
app.post('/login', async (req, res) => {
  try {
    const { email, upassword } = req.body;
    const query = 'SELECT uname, email, address, photo_path FROM users WHERE email = $1 AND upassword = $2';
    const values = [email, upassword];

    const result = await pool.query(query, values);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      res.status(200).json(user); // Send user details as JSON response
    } else {
      res.status(401).send('Invalid credentials');
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).send('Error logging in');
  }
});


app.post('/validateUser', async (req, res) => {
  try {
    const { email } = req.body;
    const query = 'SELECT email FROM users WHERE email = $1';
    const values = [email];

    const result = await pool.query(query, values);
    if (result.rows.length > 0) {
      res.status(200).send('User exists');
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    console.error('Error validating user:', error);
    res.status(500).send('Error validating user');
  }
});



// Start the server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});