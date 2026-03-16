import express from "express";
import "dotenv/config";

const app = express();
const PORT = process.env.APP_PORT;

//Middlewader
app.use(express.json());

//roue

app.get("/", (req, res) => {
  res.send("Hello Authentication is up");
});

app.listen(PORT, () => {
  console.log("Authentication Service Running");
});
