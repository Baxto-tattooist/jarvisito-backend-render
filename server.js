import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(express.json());
app.use(cors());

// 🔐 Tus llaves desde Render
const openaiKey = process.env.OPENAI_API_KEY;
const gskKey = process.env.GSK_API_KEY;

// Clientes separados
const openai = new OpenAI({ apiKey: openaiKey });
const gsk = new OpenAI({ apiKey: gskKey, baseURL: "https://api.x.ai/v1" });

// Jarvisito personalidad
const jarvisPersona = `
Eres Jarvisito, un asistente estilo Iron Man.
Hablas con inteligencia, respeto y humor ligero.
Respondes directo y siempre ayudas a Pedro Baxin Tominez.
Siempre mantienes un tono profesional con estilo futurista.
`;

// Ruta principal
app.post("/jarvisito", async (req, res) => {
  try {
    const { prompt, model = "openai" } = req.body;

    let client;
    let modelName;

    if (model === "gsk") {
      client = gsk;
      modelName = "grok-beta"; // modelo oficial de xAI
    } else {
      client = openai;
      modelName = "gpt-4o-mini"; // barato y rápido
    }

    const completion = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: jarvisPersona },
        { role: "user", content: prompt }
      ],
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("Jarvisito Backend OK ✔");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Jarvisito Backend escuchando en ${PORT}`));
