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

const DARK_WORDS = ["ذغالی", "مشکی", "سیاه", "تیره", "تاریک", "دودی"];
const LIGHT_WORDS = ["روشن", "سفید", "کرم", "شیری", "بژ"];
const COLOR_WORD = [...DARK_WORDS, ...LIGHT_WORDS].join("|");

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
  const unsupportedSize = !size && /(\d+)\s*(?:در|x|به)\s*(\d+)/.test(sized);
  const mentioned = /کاشی|سرامیک|سنگ/.test(text);
  const product = mentioned || size || color || unsupportedSize ? "کاشی" : null;

  return { product, size, color, unsupportedSize };
}

export function interpret(previous, raw) {
  const text = String(raw ?? "").trim();
  if (!text) {
    return { ...previous, notice: "اول یک جمله بنویسید یا بگویید.", ok: false };
  }
  if (text === previous.transcript.trim()) {
    return { ...previous, notice: "", ok: true };
  }

  const parsed = parseOrder(text);
  if (!parsed.product && !parsed.size && !parsed.color) {
    return {
      ...previous,
      notice: "این را نفهمیدم. مثلاً: کاشی ۶۰ در ۶۰، رنگ تیره.",
      ok: false,
    };
  }

  const notice = parsed.unsupportedSize
    ? "این اندازه در نمونه‌ها نیست. ۶۰×۶۰ یا ۳۰×۶۰ را انتخاب کنید."
    : "";
  const full =
    /کاشی|سرامیک|سنگ/.test(normalize(text)) ||
    Boolean(parsed.size && parsed.color && parsed.color !== "ambiguous");
  const hasPrevious = Boolean(previous.product || previous.size || previous.color);

  if (!full && hasPrevious) {
    const next = {
      ...previous,
      notice,
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
    .replace(/[۰-۹٠-٩]/g, (digit) => DIGITS[digit] || digit)
    .replace(/\u200c/g, " ")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[×✕✖xX*]/g, "x")
    .replace(/\s+/g, " ")
    .trim();
}

function wordsToDigits(text) {
  return text
    .replace(/(^|\s)شصت(?=\s|$)/g, "$160")
    .replace(/(^|\s)سی(?=\s|$)/g, "$130");
}

function extractSize(sizedText) {
  const match = sizedText.match(/(30|60)\s*(?:در|x|به)\s*(30|60)/);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  const small = Math.min(a, b);
  const large = Math.max(a, b);
  if (small === 60 && large === 60) return "60x60";
  if (small === 30 && large === 60) return "30x60";
  return null;
}

function extractColor(text) {
  const directed = [
    ...text.matchAll(new RegExp(`رنگ\\s+(${COLOR_WORD})`, "g")),
  ];
  if (directed.length > 0) {
    const word = directed[directed.length - 1][1];
    return DARK_WORDS.includes(word) ? "dark" : "light";
  }

  const dark = DARK_WORDS.some((word) => text.includes(word));
  const light = LIGHT_WORDS.some((word) => text.includes(word));
  if (dark && light) return "ambiguous";
  if (dark) return "dark";
  if (light) return "light";
  return null;
}
