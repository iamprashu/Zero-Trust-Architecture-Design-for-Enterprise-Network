import express from "express";
import prisma from "@repo/db";

const app = express();

app.get("/users", async (req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

app.listen(3001, () => {
  console.log("Auth Service running on 3001");
});
