import { handleAlipayNotify } from "@/lib/commerce/payment";

export async function POST(req: Request) {
  const text = await handleAlipayNotify(req);
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
