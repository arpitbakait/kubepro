import keys from "./keys";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { Pool } from "pg";
import redis from "redis";

const app = express();

app.use(cors());
app.use(bodyParser.json());

//postgresd database
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort,
});
pgClient.on("error", () => {
  console.log("post gres database error");
});

pgClient
  .query("CREATE TABLE IF NOT EXISTS values (number INT)")
  .catch((err) => console.log(err));

// redis database
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000,
});
redisClient.on("connect", () => {
  console.log(`redis connected on ${keys.redisHost}:${keys.redisPort}`);
});
redisClient.on("error", (error) => {
  console.log(error);
  console.log(`ERROR! ${keys.redisHost}:${keys.redisPort} not connected`);
});
const redisPublisher = redisClient.duplicate();

// routes
app.get("/", async (req, res) => {
  res.status(200).send("sserver is working");
});
app.get("/values/all", async (req, res) => {
  const values = await pgClient.query("SELECT * from values");
  console.log("/values/all:", values.rows);
  res.send(values.rows);
});

app.get("/values/current", async (req, res) => {
  redisClient.hgetall("values", (err, values) => {
    res.send(values);
  });
});

app.post("/values", async (req, res) => {
  const index = req.body.index;
  console.log(index);
  if (parseInt(index) > 40) {
    return res.status(422).send("Index too high");
  }

  redisClient.hset("values", index, "Nothing yet!");
  redisPublisher.publish("insert", index);
  pgClient.query("INSERT INTO values(number) VALUES($1)", [index]);
  res.send({ working: true });
});

app.listen(5000, (err) => console.log("node server is listning"));
