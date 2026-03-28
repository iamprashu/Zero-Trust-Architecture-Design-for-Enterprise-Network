import express, { Request, Response } from "express";
import "dotenv/config";

const app = express();

app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.send("Device Service is Running");
});

app.listen(3001, () => {
  console.log(`Device Service is Listining on ${3001}`);
});
