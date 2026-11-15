import {
  COLOR_LABEL,
  SIZE_LABEL,
  blankOrder,
  chooseColor,
  chooseSize,
  interpret,
  nearbyTiles,
  nextStep,
} from "./catalog.js";

const EXAMPLE = "کاشی ۶۰ در ۶۰، رنگ تیره";
const VOICE_HINT = "اگر میکروفون نبود، همان را بنویسید.";
const VOICE_MISSING = "این مرورگر گفتار را ندارد. جمله را بنویسید.";

const voiceSupported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

const ui = {
  order: blankOrder(),
  step: "listen",
  ask: null,
  matches: [],
  selectedId: null,
  listening: false,
  voiceMessage: voiceSupported ? VOICE_HINT : VOICE_MISSING,
};

let recognition = null;

const view = document.querySelector("#view");
const live = document.querySelector("#live");

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (action === "mic") toggleMic();
  if (action === "example") submitText(EXAMPLE);
  if (action === "size") commit(chooseSize(ui.order, target.dataset.size));
  if (action === "color") commit(chooseColor(ui.order, target.dataset.color));
  if (action === "pick") pickTile(target.dataset.tileId);
  if (action === "back") backToSpeech();
  if (action === "reset") resetOrder();
});

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.matches("[data-form='order']")) return;
  event.preventDefault();
  const input = form.querySelector("input");
  submitText(input ? input.value : "");
});

render();

function submitText(raw) {
  const next = interpret(ui.order, raw);
  if (next.reply) speak(next.reply);
  else stopSpeaking();
  if (!next.ok) {
    ui.order = next;
    render();
    return;
  }
  commit(next);
}

function commit(order) {
  ui.order = order;
  const step = nextStep(order);
  if (step === "samples") {
    ui.step = "samples";
    ui.ask = null;
    ui.matches = nearbyTiles(order.size, order.color);
    ui.selectedId = null;
  } else if (step === "ask-size" || step === "ask-color") {
    ui.step = "ask";
    ui.ask = step === "ask-size" ? "size" : "color";
  } else {
    ui.step = "listen";
    ui.ask = null;
  }
  render();
}

function pickTile(id) {
  if (!ui.matches.some((item) => item.tile.id === id)) return;
  ui.selectedId = id;
  ui.step = "summary";
  render();
}

function backToSpeech() {
  ui.step = "listen";
  ui.ask = null;
  ui.order = { ...ui.order, notice: "" };
  render();
}

function resetOrder() {
  ui.order = blankOrder();
  ui.step = "listen";
  ui.ask = null;
  ui.matches = [];
  ui.selectedId = null;
  ui.listening = false;
  render();
}

function render() {
  markSteps();
  view.innerHTML = screenHtml();
  if (live) live.textContent = liveMessage();
}

function markSteps() {
  const index = ui.step === "summary" ? 2 : ui.step === "samples" ? 1 : 0;
  document.querySelectorAll("#steps li").forEach((item, itemIndex) => {
    item.classList.toggle("is-now", itemIndex === index);
    item.classList.toggle("is-done", itemIndex < index);
  });
}

function liveMessage() {
  if (ui.order.reply) return ui.order.reply;
  if (ui.order.notice) return ui.order.notice;
  if (ui.step === "ask" && ui.ask === "size") return "اندازه را مشخص کنید.";
  if (ui.step === "ask" && ui.ask === "color") return "رنگ را مشخص کنید.";
  if (ui.step === "samples") return `${ui.matches.length} کاشی نزدیک آماده است.`;
  if (ui.step === "summary") {
    const tile = selectedTile();
    return tile ? `سفارش ثبت شد. ${tile.name}` : "سفارش ثبت شد.";
  }
  return "جمله سفارش را بگویید یا بنویسید.";
}

function screenHtml() {
  if (ui.step === "ask") return askHtml();
  if (ui.step === "samples") return samplesHtml();
  if (ui.step === "summary") return summaryHtml();
  return listenHtml();
}

function listenHtml() {
  return `
    <section class="screen" data-screen="listen">
      <h2>بگویید چه کاشی‌ای می‌خواهید</h2>
      <p class="lead">سلام بگویید، یا اندازه و رنگ کاشی را بگویید. نوشتن مثل گفتن است.</p>
      ${replyHtml()}
      ${noticeHtml()}
      ${composer("نشان دادن کاشی‌ها")}
      <button type="button" class="example" data-action="example">نمونه: ${esc(EXAMPLE)}</button>
    </section>
  `;
}

function askHtml() {
  const sizeKnown = ui.order.size ? SIZE_LABEL[ui.order.size] : "";
  const colorKnown = ui.order.color ? COLOR_LABEL[ui.order.color] : "";
  const title = ui.ask === "size" ? "اندازه را مشخص کنید" : "رنگ را مشخص کنید";
  let detail = "یکی را انتخاب کنید، یا جمله را کامل‌تر بگویید.";
  if (ui.ask === "size" && colorKnown) detail = `رنگ ${colorKnown} را از حرف شما برداشتم.`;
  if (ui.ask === "color" && sizeKnown) detail = `اندازه ${sizeKnown} را از حرف شما برداشتم.`;
  if (ui.ask === "color" && ui.order.colorAmbiguous) {
    detail = "هم روشن گفتید هم تیره. یکی را انتخاب کنید.";
  }

  const chips =
    ui.ask === "size"
      ? `
        <button type="button" class="chip" data-action="size" data-size="60x60">۶۰×۶۰</button>
        <button type="button" class="chip" data-action="size" data-size="30x60">۳۰×۶۰</button>
      `
      : `
        <button type="button" class="chip" data-action="color" data-color="light">روشن</button>
        <button type="button" class="chip" data-action="color" data-color="dark">تیره</button>
      `;

  return `
    <section class="screen" data-screen="ask">
      <h2>${title}</h2>
      <p class="lead">${esc(detail)}</p>
      ${replyHtml()}
      ${noticeHtml()}
      <div class="chips">${chips}</div>
      ${composer("ادامه")}
      <button type="button" class="text-btn" data-action="back">برگشت</button>
    </section>
  `;
}

function samplesHtml() {
  const cards = ui.matches
    .map(({ tile, score }) => {
      const best = score === 4;
      return `
        <button type="button" class="tile ${best ? "is-best" : ""}" data-action="pick" data-tile-id="${esc(tile.id)}">
          ${swatchHtml(tile)}
          ${best ? '<span class="badge">نزدیک‌ترین</span>' : '<span class="near">نزدیک</span>'}
          <span class="tile-name">${esc(tile.name)}</span>
          <span class="tile-meta">${SIZE_LABEL[tile.size]} · ${COLOR_LABEL[tile.color]}</span>
        </button>
      `;
    })
    .join("");

  return `
    <section class="screen" data-screen="samples">
      <h2>کاشی‌های نزدیک</h2>
      <p class="lead">این‌ها به حرف شما نزدیک‌اند. یکی را انتخاب کنید.</p>
      ${replyHtml()}
      <ul class="tags">
        <li>محصول: ${esc(ui.order.product || "کاشی")}</li>
        <li>اندازه: ${SIZE_LABEL[ui.order.size] || ""}</li>
        <li>رنگ: ${COLOR_LABEL[ui.order.color] || ""}</li>
      </ul>
      <div class="grid">${cards}</div>
      <button type="button" class="text-btn" data-action="back">جمله دیگر</button>
    </section>
  `;
}

function summaryHtml() {
  const tile = selectedTile();
  if (!tile) return listenHtml();
  const sentence = `${tile.name}، اندازه ${SIZE_LABEL[tile.size]}، رنگ ${COLOR_LABEL[tile.color]}.`;
  return `
    <section class="screen summary" data-screen="summary">
      <p class="done">سفارش ثبت شد</p>
      <h2>${esc(tile.name)}</h2>
      ${swatchHtml(tile)}
      <p class="lead">${esc(sentence)}</p>
      <dl class="facts">
        <div><dt>محصول</dt><dd>${esc(tile.product)}</dd></div>
        <div><dt>اندازه</dt><dd>${SIZE_LABEL[tile.size]}</dd></div>
        <div><dt>رنگ</dt><dd>${COLOR_LABEL[tile.color]}</dd></div>
      </dl>
      ${replyHtml()}
      <p class="heard">شنیدم: «${esc(ui.order.transcript)}»</p>
      <button type="button" class="primary" data-action="reset">سفارش تازه</button>
    </section>
  `;
}

function composer(submitLabel) {
  const disabled = voiceSupported ? "" : "disabled";
  const pressed = ui.listening ? "true" : "false";
  const micClass = ui.listening ? "mic is-on" : "mic";
  const micLabel = ui.listening ? "شنیدن…" : "گفتن";
  return `
    <div class="composer">
      <button type="button" class="${micClass}" data-action="mic" aria-pressed="${pressed}" ${disabled}>
        ${micIcon()}
        <span>${micLabel}</span>
      </button>
      <p id="voice-status" class="status">${esc(ui.voiceMessage)}</p>
      <form data-form="order">
        <label for="q">جمله سفارش</label>
        <input id="q" name="q" type="text" inputmode="text" enterkeyhint="done" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(EXAMPLE)}" value="${esc(ui.order.transcript)}" />
        <button class="primary" type="submit">${esc(submitLabel)}</button>
      </form>
    </div>
  `;
}

function replyHtml() {
  if (!ui.order.reply) return "";
  return `<p class="reply" data-reply>${esc(ui.order.reply)}</p>`;
}

function noticeHtml() {
  if (!ui.order.notice || ui.order.notice === ui.order.reply) return "";
  return `<p class="notice" data-notice>${esc(ui.order.notice)}</p>`;
}

function swatchHtml(tile) {
  const dark = tile.color === "dark" ? "is-dark" : "";
  return `
    <span class="swatch-frame">
      <span class="swatch swatch--${esc(tile.pattern)} size-${esc(tile.size)} ${dark}"></span>
    </span>
  `;
}

function selectedTile() {
  const match = ui.matches.find((item) => item.tile.id === ui.selectedId);
  return match ? match.tile : null;
}

function micIcon() {
  return `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>`;
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toggleMic() {
  const rec = getRecognition();
  if (!rec) {
    ui.voiceMessage = VOICE_MISSING;
    render();
    return;
  }
  if (ui.listening) {
    rec.stop();
    return;
  }
  stopSpeaking();
  try {
    rec.start();
  } catch {
    ui.voiceMessage = "گفتار شروع نشد. جمله را بنویسید.";
    ui.listening = false;
    render();
  }
}

function getRecognition() {
  if (recognition) return recognition;
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return null;
  try {
    const rec = new Ctor();
    rec.lang = "fa-IR";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => updateVoiceUi(true, "در حال شنیدن…");
    rec.onend = () => {
      if (ui.voiceMessage === "در حال شنیدن…") {
        updateVoiceUi(false, voiceSupported ? VOICE_HINT : VOICE_MISSING);
      } else {
        updateVoiceUi(false, ui.voiceMessage);
      }
    };
    rec.onerror = (event) => {
      const message = voiceError(event.error);
      ui.voiceMessage = message;
      updateVoiceUi(false, message);
    };
    rec.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (const result of event.results) {
        const piece = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += piece;
        else interim += piece;
      }
      const shown = (finalText || interim).trim();
      const input = document.querySelector("#q");
      if (input && shown) input.value = shown;
      if (finalText.trim()) submitText(finalText.trim());
    };
    recognition = rec;
    return rec;
  } catch {
    return null;
  }
}

function updateVoiceUi(listening, message) {
  ui.listening = listening;
  ui.voiceMessage = message;
  const mic = document.querySelector("[data-action='mic']");
  const status = document.querySelector("#voice-status");
  if (!mic || !status) return;
  mic.classList.toggle("is-on", listening);
  mic.setAttribute("aria-pressed", listening ? "true" : "false");
  const label = mic.querySelector("span");
  if (label) label.textContent = listening ? "شنیدن…" : "گفتن";
  status.textContent = message;
}

function speak(text) {
  const synth = window.speechSynthesis;
  if (!synth || !text) return;
  try {
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "fa-IR";
    utter.rate = 1;
    synth.speak(utter);
  } catch {
    return;
  }
}

function stopSpeaking() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    return;
  }
}

function voiceError(code) {
  if (code === "not-allowed" || code === "service-not-allowed") {
    return "اجازه میکروفون داده نشد. جمله را بنویسید.";
  }
  if (code === "no-speech") return "صدایی شنیده نشد. دوباره بگویید یا بنویسید.";
  if (code === "language-not-supported") return "فارسی برای گفتار آماده نیست. جمله را بنویسید.";
  return "گفتار ممکن نشد. جمله را بنویسید.";
}
