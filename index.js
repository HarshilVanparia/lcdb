const express = require('express');
const multer = require('multer');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'local_community',
  password: 'ghost123',
  port: 5432,
});

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// Serve static files from the "uploads" directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Register route
app.post('/register', upload.single('photo_path'), async (req, res) => {
  try {
    const { uname, email, unumber, country, city, address, upassword } = req.body;
    const imageFilename = req.file ? req.file.filename : null;

    const query = `
      INSERT INTO users (uname, email, unumber, country, city, address, upassword, photo_path)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [uname, email, unumber, country, city, address, upassword, imageFilename];

    const result = await pool.query(query, values);
    res.status(201).send(`User registered successfully: ID ${result.rows[0].id}`);
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).send('Error registering user');
  }
});

// Login route
app.post('/login', async (req, res) => {
  try {
    const { email, upassword } = req.body;
    const query = 'SELECT uname, email, address, photo_path FROM users WHERE email = $1 AND upassword = $2';
    const values = [email, upassword];

    const result = await pool.query(query, values);
    if (result.rows.length > 0) {
      res.status(200).json(result.rows[0]);
    } else {
      res.status(401).send('Invalid credentials');
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).send('Error logging in');
  }
});


// upload post route
// Upload post route without token
app.post('/uploadPost', upload.single('pimg'), async (req, res) => {
  try {
    const { email, pdetails, ptags } = req.body; // Accept email, details, and tags
    const imagePath = req.file ? req.file.filename : null;

    if (!email || !pdetails || !ptags || !imagePath) {
      return res.status(400).send('Missing required fields');
    }

    // Fetch username and userphoto based on email
    const userQuery = `
      SELECT uname, photo_path 
      FROM users 
      WHERE email = $1;
    `;
    const userResult = await pool.query(userQuery, [email]);

    if (userResult.rows.length === 0) {
      return res.status(404).send('User not found');
    }

    const { uname: username, photo_path: userphoto } = userResult.rows[0];

    // Insert post into the database
    const postQuery = `
      INSERT INTO posts (username, userphoto, pdetails, ptags, pimg)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const postValues = [username, userphoto, pdetails, ptags, imagePath];

    const postResult = await pool.query(postQuery, postValues);

    res.status(201).send(`Post created successfully: ID ${postResult.rows[0].postid}`);
  } catch (error) {
    console.error('Error uploading post:', error);
    res.status(500).send('Error uploading post');
  }
});



// Start the server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
