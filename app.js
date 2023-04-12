const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
const bcrypt = require("bcrypt");
app.use(express.json());
const jwt = require("jsonwebtoken");
module.exports = app;

const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

app.post("/register/", async (request, response) => {
  const { username, name, password, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `
    SELECT * FROM user WHERE username='${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (password.length < 6) {
    response.status(400);
    response.send("Password is too short");
  } else if (dbUser === undefined) {
    const createUser = `
        INSERT INTO 
           user (username,name,password,gender)
        VALUES (
            '${username}',
            '${name}',
            '${hashedPassword}',
            '${gender}'
        );
        `;
    await db.run(createUser);
    response.status(200);
    response.send("User created successfully");
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "asdfghjkl");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "asdfghjkl", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getTweets = `
    SELECT username as userName,tweet,date_time as dateTime FROM user NATURAL JOIN tweet
    WHERE username = '${username}';`;
  const tweetsArray = await db.all(getTweets);
  response.send(tweetsArray);
});

app.get("/user/following/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getNameOfFollowingPerson = `
    SELECT DISTINCT username as name FROM 
    user NATURAL JOIN follower WHERE user_id = follower_user_id;`;
  const names = await db.all(getNameOfFollowingPerson);
  response.send(names);
});

app.get("/user/follower/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getNameOfFollowingPerson = `
    SELECT DISTINCT username as name FROM 
    user NATURAL JOIN follower WHERE user_id = following_user_id;`;
  const names = await db.all(getNameOfFollowingPerson);
  response.send(names);
});
