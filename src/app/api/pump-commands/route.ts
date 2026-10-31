import { json } from "@/lib/server/http";
export async function POST() {
  return json(
    {
      error:
        "Remote pump control is disabled. This website provides public read-only monitoring.",
    },
    403,
  );
}
