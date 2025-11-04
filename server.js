import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend работает 🚀");
});

const PORT = process.env.PORT || 3021;
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
