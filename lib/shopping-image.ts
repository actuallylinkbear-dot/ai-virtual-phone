import { generateImageFromConfiguredApi } from "./image-generation-service";

/**
 * 购物 App 的商品实拍图。
 *
 * 设计要点：
 * - 商品本身是 LLM 编出来的，所以配的是「AI 生成的写实商品图」，不是真实商品照片。
 * - 图片按需生成（用户点开商品详情时才生成），生成结果存成 media-store:// 引用，
 *   不把 base64 写进购物状态，避免存档膨胀。
 * - 复用用户在「设置 → 生图」里已配置好的生图 API，这里不管理任何 key。
 */

export type ShoppingImageProductInput = {
  title: string;
  merchantLabel?: string;
  tagLabel?: string;
  subtitle?: string;
  detail?: string;
};

const STYLE_HINTS = [
  "电商商品实拍图",
  "写实商品摄影",
  "居中构图",
  "柔和均匀的影棚布光",
  "浅灰或纯白渐变背景",
  "商品本体清晰锐利、材质细节可辨",
  "高清，画质干净",
  "不要出现任何文字、水印、logo、价格标签、边框或拼贴",
  "不要出现人物正脸",
];

/** 同一件商品重新生成时，用 variant 换一个构图角度。 */
const VARIANT_HINTS = [
  "正面平视角度，商品完整入镜",
  "略微俯视的四分之三角度，商品完整入镜",
  "近距离特写，突出材质与做工细节",
  "带轻微景深的使用场景氛围，商品为画面主体",
];

function clean(value: unknown, maxLength: number): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function buildShoppingProductImagePrompt(product: ShoppingImageProductInput, variant = 0): string {
  const title = clean(product.title, 120);
  const merchant = clean(product.merchantLabel, 60);
  const tag = clean(product.tagLabel, 40);
  const subtitle = clean(product.subtitle, 160);
  const detail = clean(product.detail, 400);

  const parts: string[] = [];
  parts.push(`为这件商品生成一张商品主图：${title}。`);

  const facts: string[] = [];
  if (tag) facts.push(`品类：${tag}`);
  if (merchant) facts.push(`店铺：${merchant}`);
  if (subtitle) facts.push(`卖点：${subtitle}`);
  if (detail) facts.push(`细节：${detail}`);
  if (facts.length > 0) parts.push(facts.join("；") + "。");

  parts.push("画面内容必须严格对得上上面描述的商品，不要加与描述无关的元素。");
  parts.push(VARIANT_HINTS[Math.abs(variant) % VARIANT_HINTS.length] + "。");
  parts.push(STYLE_HINTS.join("，") + "。");

  return parts.join("\n");
}

export type ShoppingImageResult = {
  imageRef: string;
  dataUrl: string;
};

/**
 * 生成/重新生成一张商品实拍图。
 * 生图未启用或未配置时抛错，由调用方提示用户去设置里开启。
 */
export async function generateShoppingProductImage(params: {
  product: ShoppingImageProductInput;
  variant?: number;
  signal?: AbortSignal;
}): Promise<ShoppingImageResult> {
  const prompt = buildShoppingProductImagePrompt(params.product, params.variant ?? 0);

  const result = await generateImageFromConfiguredApi({
    description: prompt,
    signal: params.signal,
  });

  if (!result) {
    throw new Error(
      "生图未启用或未配置。请到「设置 → 生图」里填写生图 API（或代理地址）并打开开关后重试。",
    );
  }

  return { imageRef: result.mediaRef, dataUrl: result.dataUrl };
}
