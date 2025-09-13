export default async function handler(req, res) {
  const scriptUrl = "https://script.google.com/macros/s/AKfycbyWkP9FX_rkE-5xq7NtPYd9Dd3HkQWKJ0MSWnIIhd8jcjpb52iJP-g93xINAMXdaLdk/exec";

  try {
    let response;
    if (req.method === "POST") {
      response = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
    } else {
      response = await fetch(scriptUrl);
    }

    const data = await response.json();

    // Aqui você pode liberar CORS de forma segura
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json(data);
  } catch (err) {
    console.error("Erro no proxy:", err);
    res.status(500).json({ ok: false, error: "Erro no proxy" });
  }
}
