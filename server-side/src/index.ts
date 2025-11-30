import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import walletRouter from "./routes/wallet";
import { WebSocketService } from "./services/websocket";

console.log("Starting backend...");

// Allow JSON.stringify to handle BigInt by emitting strings
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

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
const server = createServer(app);

// Initialize WebSocket service
export const wsService = new WebSocketService(server);

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`WebSocket server ready for connections`);
});
