import { cookies } from "next/headers";
import { OWNER_COOKIE } from "@/lib/constants";

export async function getOwnerKey(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(OWNER_COOKIE)?.value;
}
