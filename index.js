const express = require('express');
const multer = require('multer');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');

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

    // Check if email already exists
    const emailCheckQuery = `SELECT * FROM users WHERE email = $1`;
    const emailCheckResult = await pool.query(emailCheckQuery, [email]);

    if (emailCheckResult.rows.length > 0) {
      return res.status(409).json({ message: 'Email is already registered' });
    }

    // Insert user if email does not exist
    const insertQuery = `
      INSERT INTO users (uname, email, unumber, country, city, address, upassword, photo_path)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING userid, uname, email;
    `;
    const values = [uname, email, unumber, country, city, address, upassword, imageFilename];
    const result = await pool.query(insertQuery, values);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        userid: result.rows[0].userid,
        uname: result.rows[0].uname,
        email: result.rows[0].email,
      },
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Failed to register user' });
  }
});

// UserProfiledata route
app.get('/getUserProfile', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  try {
    const query = 'SELECT uname, email, address, photo_path FROM users WHERE id = $1';
    const result = await pool.query(query, [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving user profile' });
  }
});

// Login route
app.post('/login', async (req, res) => {
  try {
    const { email, upassword } = req.body;

    // Validate input
    if (!email || !upassword) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Query to check the user credentials
    const query = `
      SELECT userid, uname, email, address, photo_path 
      FROM users 
      WHERE email = $1 AND upassword = $2
    `;
    const values = [email, upassword];

    // Execute the query
    const result = await pool.query(query, values);

    if (result.rows.length > 0) {
      // Return user data (excluding password for security reasons)
      const user = result.rows[0];
      return res.status(200).json(user);
    } else {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Error during login:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});




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






// Add Product Endpoint
app.post('/addProduct', upload.single('pimg'), async (req, res) => {
  const { product_title, title, pdetails, brandName, categoryId } = req.body;
  const pimg = req.file ? req.file.filename : null;

  console.log('Received product:', req.body);
  console.log('Uploaded Product Image:', req.file);

  // Validate fields
  if (
    !product_title?.trim() ||
    !title?.trim() ||
    !pdetails?.trim() ||
    !brandName?.trim() ||
    !categoryId ||
    !pimg
  ) {
    return res.status(400).json({
      error: 'All fields (product title, category title, details, brand name, category ID, and image) are required',
    });
  }

  const sql = `
    INSERT INTO products (product_title, title, pdetails, pimg, brandName, category_id)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING pid
  `;

  try {
    const result = await pool.query(sql, [
      product_title,
      title,
      pdetails,
      pimg,
      brandName,
      categoryId,
    ]);

    res.status(201).json({
      message: 'Product added successfully',
      productId: result.rows[0].pid,
    });
  } catch (err) {
    console.error('Error inserting product:', err);
    res.status(500).json({ error: 'Database error while adding product' });
  }
});

// Add Category Endpoint (for custom categories)
app.post('/addCategory', upload.single('img'), async (req, res) => {
  const customTitle = req.body.title;
  let imageName = 'default.png';

  if (req.file) {
    imageName = req.file.filename;
  }

  console.log('Received category title:', customTitle);
  console.log('Category image:', imageName);

  // Check for empty title
  if (!customTitle?.trim()) {
    console.error('Error: Missing category title');
    return res.status(400).json({ error: 'Category title is required' });
  }

  try {
    const query = `
      INSERT INTO categories (title, img)
      VALUES ($1, $2) RETURNING id
    `;
    const values = [customTitle, imageName];
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      console.error('Error: No rows returned from database');
      throw new Error('Insertion failed. No rows returned.');
    }

    const newCategoryId = result.rows[0].id;
    console.log('Inserted category ID:', newCategoryId);

    res.status(201).json({ categoryId: newCategoryId });
  } catch (error) {
    console.error('Database error:', error.message);
    res.status(500).json({ error: 'Failed to add category.' });
  }
});






// categories route
app.get('/getCategories', async (req, res) => {
  try {
    console.log('Fetching categories...');
    const query = 'SELECT id, title, img FROM categories ORDER BY id ASC'; // Fetch all categories
    const result = await pool.query(query);

    // Debugging response data
    console.log('Fetched categories:', result.rows);

    res.status(200).json(result.rows); // Send categories as JSON response
  } catch (error) {
    console.error('Error fetching categories:', error.message, error.stack);
    res.status(500).json({ error: 'Error fetching categories' });
  }
});


// Get all posts route
app.get('/getPosts', async (req, res) => {
  try {
    console.log('Fetching posts...');
    const query = 'SELECT * FROM posts ORDER BY postid DESC';
    const result = await pool.query(query);

    // Debugging response data
    console.log('Fetched posts:', result.rows);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching posts:', error.message, error.stack);
    res.status(500).json({ error: 'Error fetching posts' });
  }
});



// Add comment
app.post('/add-comment', async (req, res) => {
  try {
    const { postid, userid, userphoto, username, comment } = req.body;
    const query = `
      INSERT INTO comments (postid, userid, userphoto, username, comment)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await pool.query(query, [postid, userid, userphoto, username, comment]);
    res.status(201).json({ comment: result.rows[0] });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Fetch comments for a specific post
app.get('/comments/:postid', async (req, res) => {
  try {
    const { postid } = req.params;
    const query = `
      SELECT * FROM comments 
      WHERE postid = $1 
      ORDER BY created_at DESC;
    `;
    const result = await pool.query(query, [postid]);
    res.status(200).json({ comments: result.rows });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});


// fetching products
app.get('/products/:category', async (req, res) => {
  const { category } = req.params;
  try {
    const query = `
      SELECT title, price, imageurl 
      FROM products 
      WHERE categoryname = $1;
    `;
    const result = await pool.query(query, [category]);

    // Log the response for debugging
    console.log('Fetched products:', result.rows);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});







// Start the server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
