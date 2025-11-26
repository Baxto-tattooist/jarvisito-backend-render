
// server.js - Jarvisito Backend (completo)
const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiter básico (protege endpoints públicos)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // 200 requests por IP por ventana
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// --- Health & root ---
app.get("/health", (req, res) => res.status(200).send("OK"));
app.get("/", (req, res) => res.send("Jarvisito Backend se está ejecutando."));

// --- 1) /ai : llama a la API de IA (OpenAI) ---
app.post("/ai", async (req, res) => {
  try {
    const { prompt, system } = req.body;
    if (!prompt) return res.status(400).json({ error: "Falta el prompt" });

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY no configurada" });
    }

    const payload = {
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [],
    };

    if (system) payload.messages.push({ role: "system", content: system });
    payload.messages.push({ role: "user", content: prompt });

    const r = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const reply =
      r.data?.choices?.[0]?.message?.content ||
      r.data?.choices?.[0]?.text ||
      JSON.stringify(r.data);
    res.json({ reply });
  } catch (err) {
    console.error("AI error:", err.response?.data || err.message || err);
    res.status(500).json({ error: "Error llamando a la IA" });
  }
});

// --- 2) /notify : envía notificaciones vía n8n u otro webhook ---
app.post("/notify", async (req, res) => {
  try {
    const { message, channel = "default", meta } = req.body;
    if (!message) return res.status(400).json({ error: "Mensaje requerido" });
    if (!process.env.N8N_WEBHOOK_URL)
      return res.status(500).json({ error: "N8N_WEBHOOK_URL no configurada" });

    await axios.post(process.env.N8N_WEBHOOK_URL, {
      type: "notification",
      channel,
      message,
      meta: meta || {},
      receivedAt: new Date().toISOString(),
    });

    res.json({ status: "Enviado a n8n" });
  } catch (err) {
    console.error("Notify error:", err.response?.data || err.message || err);
    res.status(500).json({ error: "Error enviando notificación" });
  }
});

// --- 3) /task : crear tareas (envía a n8n o guarda en DB si agregas una) ---
app.post("/task", async (req, res) => {
  try {
    const { description, datetime } = req.body;
    if (!description) return res.status(400).json({ error: "Descripción requerida" });
    if (!process.env.N8N_WEBHOOK_URL)
      return res.status(500).json({ error: "N8N_WEBHOOK_URL no configurada" });

    await axios.post(process.env.N8N_WEBHOOK_URL, {
      type: "task",
      description,
      datetime: datetime || null,
      createdAt: new Date().toISOString(),
    });

    res.json({ status: "Tarea creada" });
  } catch (err) {
    console.error("Task error:", err.response?.data || err.message || err);
    res.status(500).json({ error: "Error creando tarea" });
  }
});

// --- 4) /webhook : endpoint general para recibir webhooks (n8n, stripe, etc.) ---
app.post("/webhook", (req, res) => {
  try {
    console.log("Webhook recibido:", JSON.stringify(req.body).slice(0, 2000));
    res.status(200).json({ status: "Recibido" });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Error procesando webhook" });
  }
});

// --- 5) /chat : conversación con memoria simple por sessionId ---
const sessions = {}; // en memoria (temporal); cambia a DB para persistencia
const MAX_MESSAGES_PER_SESSION = 30;

app.post("/chat", async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    if (!sessionId || !message)
      return res.status(400).json({ error: "sessionId y message requeridos" });

    if (!process.env.OPENAI_API_KEY)
      return res.status(500).json({ error: "OPENAI_API_KEY no configurada" });

    if (!sessions[sessionId]) sessions[sessionId] = [];

    // Añade mensaje del usuario
    sessions[sessionId].push({ role: "user", content: message });

    // Trunca si hay demasiados mensajes
    if (sessions[sessionId].length > MAX_MESSAGES_PER_SESSION) {
      sessions[sessionId] = sessions[sessionId].slice(-MAX_MESSAGES_PER_SESSION);
    }

    const payload = {
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: sessions[sessionId],
    };

    const r = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const aiResponse = r.data?.choices?.[0]?.message?.content || "Sin respuesta";
    sessions[sessionId].push({ role: "assistant", content: aiResponse });

    res.json({ reply: aiResponse });
  } catch (err) {
    console.error("Chat error:", err.response?.data || err.message || err);
    res.status(500).json({ error: "Error en chat" });
  }
});

// --- 6) /login : simple auth basada en variables de entorno (sin DB) ---
app.post("/login", (req, res) => {
  try {
    const { user, pass } = req.body;
    if (!user || !pass) return res.status(400).json({ error: "user y pass requeridos" });

    const ADMIN_USER = process.env.ADMIN_USER;
    const ADMIN_PASS = process.env.ADMIN_PASS;
    const ADMIN_TOKEN = process.env.ADMIN_TOKEN || crypto.randomUUID();

    if (!ADMIN_USER || !ADMIN_PASS) {
      return res.status(500).json({ error: "Credenciales de admin no configuradas" });
    }

    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      return res.json({
        token: ADMIN_TOKEN,
        expiresIn: 60 * 60 * 24, // 1 día en segundos (puedes cambiar)
      });
    }

    return res.status(403).json({ error: "Credenciales inválidas" });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Error en login" });
  }
});

// --- 404 ---
app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

// --- Start server ---
app.listen(port, () => {
  console.log(`Jarvisito Backend escuchando en el puerto ${port}`);
});