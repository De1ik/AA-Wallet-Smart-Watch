import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import walletRouter from "./routes/wallet";

console.log("Starting backend...");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/wallet", walletRouter);

// Hello World endpoint
app.get("/", (req, res) => {
  res.json({ message: "Hello World!" });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});