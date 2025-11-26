import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// Inicializar OpenAI con tu token (viene desde Render)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Ruta principal (solo para comprobar que funciona)
app.get("/", (req, res) => {
  res.send("Jarvisito Backend funcionando correctamente ✔️");
});

// Ruta de Jarvisito con personalidad
app.get("/jarvisito", async (req, res) => {
  try {
    const msg = req.query.msg || "Hola";

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "Eres Jarvisito, un asistente con personalidad amigable, directa, leal y estilo Iron Man. Hablas siempre como un compañero inteligente."
        },
        { role: "user", content: msg }
      ]
    });

    res.json({
      respuesta: response.choices[0].message.content
    });

  } catch (error) {
    console.error("Error en /jarvisito:", error);
    res.json({ error: "Error al procesar la solicitud" });
  }
});

// Puerto para Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Jarvisito Backend escuchando en el puerto ${PORT}`);
});
