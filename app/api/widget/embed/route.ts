export const runtime = "nodejs"

/**
 * Script de incorporação. Uso: <script src=".../api/widget/embed" data-key="wk_..." async></script>
 * Constrói o painel com createElement/textContent (nunca innerHTML com texto de terceiros).
 */
const script = `(function () {
  var tag = document.currentScript;
  if (!tag) return;
  var key = tag.getAttribute("data-key");
  if (!key) return;
  var base = new URL(tag.src).origin + "/api/widget/" + encodeURIComponent(key);
  var storeKey = "lauxai_widget_" + key;
  var sessionId = null;
  try { sessionId = sessionStorage.getItem(storeKey); } catch (e) {}

  function el(name, css, text) {
    var node = document.createElement(name);
    if (css) node.style.cssText = css;
    if (text) node.textContent = text;
    return node;
  }

  fetch(base).then(function (r) { return r.ok ? r.json() : null; }).then(function (cfg) {
    if (!cfg) return;
    var color = /^#[0-9a-fA-F]{6}$/.test(cfg.primaryColor) ? cfg.primaryColor : "#0f766e";
    var side = cfg.position === "left" ? "left:20px;" : "right:20px;";
    var font = "font-family:system-ui,-apple-system,Segoe UI,sans-serif;";

    var button = el("button", "position:fixed;bottom:20px;" + side + "z-index:2147483000;width:56px;height:56px;border-radius:28px;border:0;cursor:pointer;color:#fff;font-size:24px;box-shadow:0 6px 20px rgba(0,0,0,.25);background:" + color, "\\u2709");
    button.setAttribute("aria-label", cfg.title);

    var panel = el("div", "position:fixed;bottom:88px;" + side + "z-index:2147483000;width:340px;max-width:calc(100vw - 40px);height:460px;max-height:calc(100vh - 120px);display:none;flex-direction:column;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.28);" + font);
    var header = el("div", "padding:14px 16px;color:#fff;font-weight:600;background:" + color, cfg.title);
    var list = el("div", "flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#f6f7f8");
    var form = el("form", "display:flex;gap:8px;padding:10px;border-top:1px solid #e5e7eb;background:#fff");
    var input = el("input", "flex:1;padding:10px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;color:#111;background:#fff");
    input.type = "text"; input.maxLength = 1000; input.placeholder = "Digite sua mensagem"; input.setAttribute("aria-label", "Mensagem");
    var send = el("button", "padding:0 14px;border:0;border-radius:8px;color:#fff;cursor:pointer;font-size:14px;background:" + color, "Enviar");
    send.type = "submit";
    form.appendChild(input); form.appendChild(send);
    panel.appendChild(header); panel.appendChild(list); panel.appendChild(form);

    function bubble(text, mine) {
      var b = el("div", "max-width:85%;padding:8px 12px;border-radius:12px;font-size:14px;line-height:1.4;white-space:pre-wrap;word-break:break-word;" + (mine ? "align-self:flex-end;color:#fff;background:" + color : "align-self:flex-start;color:#111;background:#fff;border:1px solid #e5e7eb"), text);
      list.appendChild(b); list.scrollTop = list.scrollHeight; return b;
    }
    bubble(cfg.welcomeMessage, false);

    button.addEventListener("click", function () {
      var open = panel.style.display === "flex";
      panel.style.display = open ? "none" : "flex";
      if (!open) input.focus();
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var text = input.value.trim();
      if (!text) return;
      input.value = ""; send.disabled = true;
      bubble(text, true);
      var wait = bubble("...", false);
      fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, sessionId: sessionId }) })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
          if (res.ok) {
            sessionId = res.data.sessionId;
            try { sessionStorage.setItem(storeKey, sessionId); } catch (e) {}
            wait.textContent = res.data.reply;
          } else {
            wait.textContent = res.data && res.data.message ? res.data.message : "Não foi possível responder agora.";
          }
        })
        .catch(function () { wait.textContent = "Sem conexão. Tente novamente."; })
        .then(function () { send.disabled = false; list.scrollTop = list.scrollHeight; });
    });

    document.body.appendChild(panel);
    document.body.appendChild(button);
  }).catch(function () {});
})();`

export function GET() {
  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  })
}
