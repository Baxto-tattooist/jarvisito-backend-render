app.get("/jarvisito", async (req, res) => {
  const msg = req.query.msg || "Hola";
  
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: "Eres Jarvisito, un asistente con personalidad amigable, leal y estilo Iron Man." },
      { role: "user", content: msg }
    ]
  });

  res.json({
    respuesta: response.choices[0].message.content
  });
});
