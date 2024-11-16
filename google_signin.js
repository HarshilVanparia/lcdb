const express = require('express');
const bodyParser = require('body-parser');
const pool = require('./db'); // Import your database configuration
const app = express();
const PORT = 3000;

app.use(bodyParser.json());

// Handle registration route
app.post('/register', async (req, res) => {
  const { uname, email, unumber, country, city, address, upassword } = req.body;

  try {
    // Check if the user already exists
    const existingUser = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(200).json({ message: "User already registered" });
    }

    // Insert a new user
    const newUser = await pool.query(
      "INSERT INTO users (uname, email, unumber, country, city, address, upassword) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [uname, email, unumber, country, city, address, upassword]
    );

    res.status(201).json({ message: "User registered successfully", user: newUser.rows[0] });
  } catch (error) {
    console.error("Error registering user", error);
    res.status(500).json({ message: "Error registering user" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
