import { headers } from "next/headers";

export async function requestIpKey(scope: string): Promise<string> {
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headersList.get("x-real-ip") || "local";
  return `${scope}:${ip}`;
}
