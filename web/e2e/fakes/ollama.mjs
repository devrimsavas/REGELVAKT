// A stand-in for Ollama in the end-to-end tests. It answers the two calls
// the assistant makes: the search terms (JSON), and the answer, which
// quotes the first deadline the rules source gives, so a test can tell
// that the company's rules reached the model.
import http from "node:http";

const PORT = Number(process.env.PORT || 4011);

function answerFor(prompt) {
  // "...: 7. desember 2026 (A-melding); ..." -> "7. desember 2026"
  const next = /De neste fristene for foretaket[^:]*: (.+?) \(/.exec(prompt);
  const first = next ? next[1].trim() : "10. april";
  return [
    `Neste frist er **${first}** [1].`,
    "",
    "- Mva-meldingen leveres annenhver måned [2].",
    "- Du må levere også når omsetningen er null [2][9].",
  ].join("\n");
}

http
  .createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      if (req.url !== "/api/chat") {
        res.writeHead(404).end();
        return;
      }
      const request = JSON.parse(body || "{}");
      const prompt = request.messages?.at(-1)?.content ?? "";
      const content =
        request.format === "json"
          ? JSON.stringify({ terms: ["mva-melding", "frist"] })
          : answerFor(prompt);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          model: request.model,
          message: { role: "assistant", content },
          done: true,
          done_reason: "stop",
        }),
      );
    });
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log(`Fake Ollama on http://127.0.0.1:${PORT}`);
  });
