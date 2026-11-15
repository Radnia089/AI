const DIGITS = {
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

const DARK_WORDS = ["ذغالی", "دغالی", "زغالی", "مشکی", "سیاه", "تیره", "تاریک", "دودی", "طوسی", "خاکستری", "شکلاتی"];
const LIGHT_WORDS = ["روشن", "سفید", "کرم", "شیری", "بژ", "استخوانی", "صدفی", "نباتی"];
const DARK_PHRASES = ["نوک مدادی", "قهوه ای"];
const LIGHT_PHRASES = ["سفید صدفی"];
const COLOR_WORD = [...DARK_WORDS, ...LIGHT_WORDS].join("|");
const UNKNOWN_COLORS = ["آبی", "ابی", "سبز", "قرمز", "زرد", "صورتی", "بنفش", "نارنجی", "طلایی", "نقره ای", "گلبهی", "گل بهی"];

export const CATALOG = [
  {
    id: "marble-60",
    name: "کاشی مرمر روشن",
    product: "کاشی",
    size: "60x60",
    color: "light",
    pattern: "marble",
  },
  {
    id: "concrete-60",
    name: "کاشی بتن تیره",
    product: "کاشی",
    size: "60x60",
    color: "dark",
    pattern: "concrete",
  },
  {
    id: "cream-60",
    name: "کاشی سرامیک کرم",
    product: "کاشی",
    size: "60x60",
    color: "light",
    pattern: "cream",
  },
  {
    id: "stone-60",
    name: "کاشی سنگ مشکی",
    product: "کاشی",
    size: "60x60",
    color: "dark",
    pattern: "stone",
  },
  {
    id: "wall-cream-30",
    name: "کاشی دیوار کرم",
    product: "کاشی",
    size: "30x60",
    color: "light",
    pattern: "wall-cream",
  },
  {
    id: "wall-charcoal-30",
    name: "کاشی دیوار ذغالی",
    product: "کاشی",
    size: "30x60",
    color: "dark",
    pattern: "wall-charcoal",
  },
];

export const SIZE_LABEL = {
  "60x60": "۶۰×۶۰",
  "30x60": "۳۰×۶۰",
};

export const COLOR_LABEL = {
  dark: "تیره",
  light: "روشن",
};

export function blankOrder() {
  return {
    transcript: "",
    product: null,
    size: null,
    color: null,
    colorAmbiguous: false,
    notice: "",
    reply: "",
  };
}

export function parseOrder(raw) {
  const text = normalize(raw);
  if (!text) {
    return { product: null, size: null, color: null, unsupportedSize: false };
  }

  const sized = wordsToDigits(text);
  const size = extractSize(sized);
  const color = extractColor(text);
  const unsupportedSize = !size && /(\d+)\s*(?:در|x|به|ضربدر|ضرب در)\s*(\d+)/.test(sized);
  const mentioned = /کاشی|سرامیک|سنگ/.test(text);
  const product = mentioned || size || color || unsupportedSize ? "کاشی" : null;

  return { product, size, color, unsupportedSize };
}

export function interpret(previous, raw) {
  const text = String(raw ?? "").trim();
  if (!text) {
    return { ...previous, reply: "", notice: "اول یک جمله بنویسید یا بگویید.", ok: false };
  }
  if (text === previous.transcript.trim()) {
    return { ...previous, notice: "", reply: "", ok: true };
  }

  const parsed = parseOrder(text);
  if (!isOrderTalk(text, parsed)) {
    const reply = everydayReply(text);
    return { ...previous, notice: reply, reply, ok: false };
  }

  const notice = orderNotice(text, parsed);
  const full =
    /کاشی|سرامیک|سنگ/.test(normalize(text)) ||
    Boolean(parsed.size && parsed.color && parsed.color !== "ambiguous");
  const hasPrevious = Boolean(previous.product || previous.size || previous.color);

  if (!full && hasPrevious) {
    const next = {
      ...previous,
      notice,
      reply: "",
      ok: true,
      transcript: `${previous.transcript} ${text}`.trim(),
      product: previous.product || "کاشی",
    };
    if (parsed.size) next.size = parsed.size;
    if (parsed.color === "light" || parsed.color === "dark") {
      next.color = parsed.color;
      next.colorAmbiguous = false;
    } else if (parsed.color === "ambiguous") {
      next.color = null;
      next.colorAmbiguous = true;
    }
    return next;
  }

  return {
    transcript: text,
    product: parsed.product,
    size: parsed.size,
    color: parsed.color === "ambiguous" ? null : parsed.color,
    colorAmbiguous: parsed.color === "ambiguous",
    notice,
    reply: "",
    ok: true,
  };
}

export function chooseSize(order, size) {
  const phrase = size === "60x60" ? "۶۰ در ۶۰" : "۳۰ در ۶۰";
  const transcript =
    parseOrder(order.transcript).size === size
      ? order.transcript
      : `${order.transcript} ${phrase}`.trim();
  return {
    ...order,
    transcript,
    product: order.product || "کاشی",
    size,
    notice: "",
    reply: "",
    ok: true,
  };
}

export function chooseColor(order, color) {
  const phrase = color === "dark" ? "رنگ تیره" : "رنگ روشن";
  const current = parseOrder(order.transcript).color;
  const transcript =
    current === color ? order.transcript : `${order.transcript} ${phrase}`.trim();
  return {
    ...order,
    transcript,
    product: order.product || "کاشی",
    color,
    colorAmbiguous: false,
    notice: "",
    reply: "",
    ok: true,
  };
}

export function nextStep(order) {
  if (!order.product && !order.size && !order.color) return "listen";
  if (!order.size) return "ask-size";
  if (!order.color || order.colorAmbiguous) return "ask-color";
  return "samples";
}

export function nearbyTiles(size, color) {
  return CATALOG.map((tile, index) => ({
    tile,
    index,
    score: (tile.size === size ? 2 : 0) + (tile.color === color ? 2 : 0),
  }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 4);
}

function normalize(raw) {
  return String(raw ?? "")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[۰-۹٠-٩]/g, (digit) => DIGITS[digit] || digit)
    .replace(/\u200c/g, " ")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[×✕✖xX*]/g, "x")
    .replace(/[؟?!.,،؛:«»"'()[\]\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordsToDigits(text) {
  return text
    .replace(/شصت\s*تایی/g, "60")
    .replace(/شصتی/g, "60")
    .replace(/سی\s*تایی/g, "30")
    .replace(/(^|\s)شصت(?=\s|$)/g, "$160")
    .replace(/(^|\s)سی(?=\s|$)/g, "$130");
}

function extractSize(sizedText) {
  const supported =
    sizedText.match(/(30|60)\s*(?:در|x|به|ضربدر|ضرب در)\s*(30|60)/) ||
    sizedText.match(/(30|60)\s+(30|60)/);
  if (supported) return sizePair(supported[1], supported[2]);
  if (/(\d+)\s*(?:در|x|به|ضربدر|ضرب در)\s*(\d+)/.test(sizedText)) return null;
  if (!allowsLoneSize(sizedText)) return null;
  const nums = [...sizedText.matchAll(/(?:^|\s)(30|60)(?=\s|$)/g)].map((item) => item[1]);
  if (nums.length !== 1) return null;
  return nums[0] === "60" ? "60x60" : "30x60";
}

function sizePair(first, second) {
  const small = Math.min(Number(first), Number(second));
  const large = Math.max(Number(first), Number(second));
  if (small === 60 && large === 60) return "60x60";
  if (small === 30 && large === 60) return "30x60";
  return null;
}

function allowsLoneSize(sizedText) {
  if (/کاشی|سرامیک|سنگ|سفارش/.test(sizedText)) return true;
  const leftover = stripOrderWords(sizedText).replace(/30|60/g, " ").replace(/\s+/g, " ").trim();
  return leftover.length === 0;
}

function extractColor(text) {
  const directed = [
    ...text.matchAll(new RegExp(`رنگ\\s+(${COLOR_WORD})`, "g")),
  ];
  if (directed.length > 0) {
    const word = directed[directed.length - 1][1];
    return DARK_WORDS.includes(word) ? "dark" : "light";
  }

  const dark =
    DARK_WORDS.some((word) => text.includes(word)) ||
    DARK_PHRASES.some((phrase) => text.includes(phrase));
  const light =
    LIGHT_WORDS.some((word) => text.includes(word)) ||
    LIGHT_PHRASES.some((phrase) => text.includes(phrase));
  if (dark && light) return "ambiguous";
  if (dark) return "dark";
  if (light) return "light";
  return null;
}

function orderNotice(raw, parsed) {
  if (parsed.unsupportedSize) {
    return "این اندازه در نمونه‌ها نیست. ۶۰×۶۰ یا ۳۰×۶۰ را انتخاب کنید.";
  }
  if (parsed.color === "light" || parsed.color === "dark" || parsed.color === "ambiguous") {
    return "";
  }
  const unknown = unknownColor(normalize(raw));
  return unknown ? `${unknown} نداریم. روشن یا تیره را بگویید.` : "";
}

function unknownColor(text) {
  return UNKNOWN_COLORS.find((word) => text.includes(word)) || "";
}

function isOrderTalk(raw, parsed) {
  const text = normalize(raw);
  if (parsed.unsupportedSize || parsed.size) return true;
  if (isRefusal(text)) return false;
  if (parsed.color && isBareColorRequest(text)) return true;
  if (isSocialLead(text) && !/کاشی|سرامیک|سنگ/.test(text)) return false;
  if (/کاشی|سرامیک|سنگ/.test(text) && !isChatQuestion(text)) return true;
  return false;
}

function isBareColorRequest(text) {
  const leftover = stripOrderWords(text);
  return leftover.length === 0 || /^(ه|باشه|باش|است|هست)$/.test(leftover);
}

function stripOrderWords(text) {
  let value = ` ${text} `;
  const words = [
    ...DARK_PHRASES,
    ...LIGHT_PHRASES,
    ...DARK_WORDS,
    ...LIGHT_WORDS,
    ...UNKNOWN_COLORS,
    "رنگ",
    "لطفا",
    "یه",
    "یک",
    "دونه",
    "میخوام",
    "می خوام",
    "برام",
    "برای من",
    "رو",
    "را",
    "و",
    "یا",
    "هم",
    "خیلی",
    "این",
    "اون",
    "همون",
    "کاشی",
    "سرامیک",
    "سنگ",
    "سفارش",
  ].sort((a, b) => b.length - a.length);
  for (const word of words) value = value.replaceAll(` ${word} `, " ");
  value = value.replace(/روشن|تیره|سفید|مشکی|سیاه/g, " ");
  return value.replace(/\s+/g, " ").trim();
}

function isRefusal(text) {
  return /نمی ?خوام|نمی‌خوام|نمیخوام|نمی خواهم|نمی‌خواهم|اشتباه شد|ولش کن|بیخیال|بی خیال|لغو/.test(text);
}

function isSocialLead(text) {
  return /^(سلام|درود|صبح بخیر|عصر بخیر|وقت بخیر|شب بخیر|ظهر بخیر|سلم|صلام|ممنون|مرسی|متشکرم|متشکر|دستت درد|دمت گرم|خداحافظ|خدافظ|خدانگهدار|بای|ببخشید|شرمنده|معذرت|خسته نباش)/.test(
    text,
  );
}

function isChatQuestion(text) {
  return /قیمت|چقدر|گرون|ارزون|ارزان|نصب|کجا|کی هستی|چیه|چیست|چه کاشی|چی داری|چیا داری|موجود|نمونه|دارید|ندارید| داری(?: |$)/.test(
    text,
  );
}

function everydayReply(raw) {
  const text = chatText(raw);
  const heard = quoteHeard(raw);

  if (isJustGreeting(text) && isHowAreYou(text)) {
    return "سلام، مرسی، خوبم. بگو چه کاشی‌ای می‌خوای.";
  }
  if (isJustGreeting(text)) return "سلام، خوبم. چه کاشی‌ای می‌خوای؟";
  if (isHowAreYou(text) && text.split(" ").length <= 5 && !/قیمت|کاشی|سایز/.test(text)) {
    return "خوبم، ممنون. تو بگو چه کاشی‌ای می‌خوای.";
  }
  if (/هوا|باران|بارون/.test(text)) {
    return "هوا دست من نیست. اگر کاشی می‌خوای، اندازه و رنگش را بگو.";
  }
  if (/ساعت/.test(text)) return "ساعت را نمی‌دانم. بگو چه کاشی‌ای می‌خوای.";
  if (/قیمت|چنده|چقد|گرون|ارزون|ارزان|هزینه/.test(text)) {
    return "قیمت اینجا نیست. بگو اندازه و رنگ تا کاشی نزدیک را بیاورم.";
  }
  if (/چی داری|چیا داری|چه کاشی|موجود|نمونه|لیست|سایز|اندازه ها|اندازه‌ها/.test(text)) {
    return "شصت در شصت و سی در شصت داریم، روشن و تیره. کدوم را می‌خوای؟";
  }
  if (/کی هستی|اسمت|کجایی|کجایین|کجا هستید|ربات/.test(text)) {
    return "من سفارش کاشی را از حرف تو درمی‌آورم. چه کاشی‌ای می‌خوای؟";
  }
  if (/کمک|راهنما|چی بگم|چیکار کنم|نمی ?فهمم|نمی‌فهمم|نمیفهمم/.test(text)) {
    return "راحت بگو. مثلاً: کاشی شصت در شصت، رنگ تیره.";
  }
  if (isRefusal(text)) return "باشه. هر وقت آماده بودی بگو چه کاشی‌ای می‌خوای.";
  if (/^(آره|آرهه|بله|باشه|اوکی|حله|چشم)$/.test(text)) return "باشه. اندازه و رنگ را بگو.";
  if (/^(نه|نخیر)$/.test(text)) return "باشه. هر وقت خواستی بگو چه کاشی‌ای می‌خوای.";
  if (/خسته نباش/.test(text)) return "سلامت باشی. چه کاشی‌ای می‌خوای؟";
  if (/ممنون|مرسی|متشکر|دستت درد|دمت گرم|قربونت|قربان/.test(text)) {
    return "خواهش می‌کنم. اندازه و رنگ کاشی را بگو.";
  }
  if (/خداحافظ|خدافظ|خدانگهدار|شب بخیر|فعلا|بای/.test(text)) {
    return "خداحافظ. هر وقت کاشی خواستی برگرد.";
  }
  if (/ببخشید|شرمنده|معذرت/.test(text)) return "مشکلی نیست. بگو چه کاشی‌ای می‌خوای.";
  if (/ارسال|پست|حمل/.test(text)) return "ارسال اینجا نیست. اول اندازه و رنگ کاشی را بگو.";
  if (/حموم|حمام|سرویس|دستشویی/.test(text)) {
    return "برای دیوار معمولاً سی در شصت می‌آید. روشن می‌خوای یا تیره؟";
  }
  if (/آشپزخانه|پذیرایی|(^| )کف( |$)/.test(text)) {
    return "برای کف معمولاً شصت در شصت می‌آید. روشن می‌خوای یا تیره؟";
  }
  if (/نصب/.test(text)) return "نصب کار من نیست. بگو چه کاشی‌ای می‌خوای تا نمونه‌ها را بیاورم.";
  if (/جوک|بخند/.test(text)) return "جوک بلد نیستم. اندازه و رنگ کاشی را بگو تا پیدا کنم.";
  if (/عالی|آفرین|خوبه|ممنون از/.test(text)) return "خوشحالم. اگر کاشی می‌خوای اندازه و رنگش را بگو.";
  if (/[؟?]/.test(String(raw)) || /^(چرا|چطور|کی |کجا|چی |چه |آیا|مگه|میشه|می شه)/.test(text)) {
    return `${heard} را شنیدم. من سفارش کاشی را جواب می‌دهم. بگو اندازه و رنگ تا نمونه‌ها را بیاورم.`;
  }
  return `${heard} را شنیدم. بگو چه کاشی‌ای می‌خوای؛ اندازه و رنگ کافی است.`;
}

function isJustGreeting(text) {
  if (!/^(سلام علیکم|صبح بخیر|عصر بخیر|وقت بخیر|ظهر بخیر|شب بخیر|سلام|درود|سلم|صلام)(?: |$)/.test(text)) {
    return false;
  }
  let rest = text
    .replace(/^(سلام علیکم|صبح بخیر|عصر بخیر|وقت بخیر|ظهر بخیر|شب بخیر|سلام|درود|سلم|صلام)/, "")
    .trim();
  const tail =
    /^(بر شما|علیکم|عرض می کنم|عرض شد|عزیزم|عزیز|داداش|جان|خوبی|خوبین|خوبید|خوب هستی|چطوری|چطورین|چطورید|چخبر|چه خبر|چه خبرا|حالت چطوره|حال شما چطوره|حال تو چطوره|تو|شما)(?: |$)/;
  for (let i = 0; i < 4 && rest; i += 1) {
    const next = rest.replace(tail, "").trim();
    if (next === rest) break;
    rest = next;
  }
  return rest.length === 0;
}

function isHowAreYou(text) {
  if (/هوا|باران|بارون/.test(text)) return false;
  if (/خوبی|خوبین|خوبید|خوب هستی|چطوری|چطورین|چطورید|چخبر|چه خبر|چه خبرا/.test(text)) return true;
  return /حال(ت|تون| شما)? چطور/.test(text);
}

function quoteHeard(raw) {
  const heard = String(raw ?? "").replace(/\s+/g, " ").trim();
  const shown = heard.length > 70 ? `${heard.slice(0, 70)}…` : heard;
  return `«${shown}»`;
}

function chatText(raw) {
  return normalize(raw)
    .replace(/[؟?!.,،؛:«»"'()[\]\-]/g, " ")
    .replace(/(.)\1{2,}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
