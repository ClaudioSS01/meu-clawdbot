/**
 * Proxy Base44 -> OpenAI Responses API (com SSE streaming)
 */

import http from "http";
import https from "https";

const PORT = 18790;
const BASE44_URL = "https://med-ai-f386cd4c.base44.app/api/apps/69692aad0ac4c7c5f386cd4c/functions/askAI";
const BASE44_API_KEY = "9788c1164c634fe8b597045a8dd5e971";

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function callBase44(text) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ text });
    log(`>>> Base44: "${text.substring(0, 60)}..."`);
    
    const url = new URL(BASE44_URL);
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api_key": BASE44_API_KEY,
        "Content-Length": Buffer.byteLength(data),
      },
    }, (res) => {
      let body = "";
      res.on("data", chunk => (body += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          log(`<<< Base44: success=${json.success}`);
          resolve(json);
        } catch (e) {
          reject(new Error(`Parse: ${body}`));
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function extractText(body) {
  if (Array.isArray(body.input)) {
    for (let i = body.input.length - 1; i >= 0; i--) {
      const msg = body.input[i];
      if (msg.role === "user") {
        if (typeof msg.content === "string") return msg.content;
        if (Array.isArray(msg.content)) {
          const t = msg.content.find(p => p.type === "input_text" || p.type === "text");
          if (t) return t.text;
        }
      }
    }
  }
  if (Array.isArray(body.messages)) {
    for (let i = body.messages.length - 1; i >= 0; i--) {
      const msg = body.messages[i];
      if (msg.role === "user") {
        if (typeof msg.content === "string") return msg.content;
      }
    }
  }
  return body.prompt || "";
}

function sendSSE(res, event) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  log(`${req.method} ${req.url}`);

  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (req.url?.includes("/models")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ data: [{ id: "base44-medai", object: "model" }] }));
    return;
  }

  if (req.method === "POST" && req.url?.includes("/responses")) {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body);
        const userText = extractText(parsed);
        const isStream = parsed.stream !== false;
        
        log(`Texto: "${userText.substring(0, 50)}..." stream=${isStream}`);

        if (!userText) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No text" }));
          return;
        }

        const base44Res = await callBase44(userText);
        
        if (!base44Res.success || !base44Res.response) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Base44 error" }));
          return;
        }

        const reply = base44Res.response;
        log(`SUCESSO: "${reply.substring(0, 50)}..."`);

        const respId = `resp_${Date.now()}`;
        const msgId = `msg_${Date.now()}`;

        if (isStream) {
          // SSE Streaming
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          });

          // response.created
          sendSSE(res, {
            type: "response.created",
            response: {
              id: respId,
              object: "response",
              status: "in_progress",
              model: parsed.model || "base44-medai",
            },
          });

          // output_item.added (message start)
          sendSSE(res, {
            type: "response.output_item.added",
            item: {
              type: "message",
              id: msgId,
              role: "assistant",
              content: [],
              status: "in_progress",
            },
          });

          // content_part.added
          sendSSE(res, {
            type: "response.content_part.added",
            part: { type: "output_text", text: "" },
          });

          // output_text.delta (envia o texto)
          sendSSE(res, {
            type: "response.output_text.delta",
            delta: reply,
          });

          // output_text.done
          sendSSE(res, {
            type: "response.output_text.done",
            text: reply,
          });

          // content_part.done
          sendSSE(res, {
            type: "response.content_part.done",
            part: { type: "output_text", text: reply },
          });

          // output_item.done (message complete)
          sendSSE(res, {
            type: "response.output_item.done",
            item: {
              type: "message",
              id: msgId,
              role: "assistant",
              status: "completed",
              content: [{ type: "output_text", text: reply, annotations: [] }],
            },
          });

          // response.completed
          sendSSE(res, {
            type: "response.completed",
            response: {
              id: respId,
              status: "completed",
              usage: { input_tokens: 10, output_tokens: 50, total_tokens: 60 },
            },
          });

          res.write("data: [DONE]\n\n");
          res.end();
        } else {
          // JSON Response
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            id: respId,
            object: "response",
            status: "completed",
            output: [{
              type: "message",
              id: msgId,
              role: "assistant",
              status: "completed",
              content: [{ type: "output_text", text: reply, annotations: [] }],
            }],
            usage: { input_tokens: 10, output_tokens: 50 },
          }));
        }
      } catch (err) {
        log(`ERRO: ${err.message}`);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("==========================================");
  console.log("  PROXY BASE44 - PORTA " + PORT);
  console.log("==========================================");
  console.log("Suporta: /v1/responses (SSE stream)");
  console.log("==========================================");
});
