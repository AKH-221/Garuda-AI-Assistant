import app from "./App.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
