import express from "express";
import { prisma } from "@repo/db";

const app = express();

app.use(express.json());

app.post("/users", async (req, res) => {
  try {
    const user = await prisma.user.create({
      data: {
        email: req.body.email,
        password: req.body.password,
      },
    });
    return res.json(user);
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => {
  console.log("Auth Service running on 3001");
});
