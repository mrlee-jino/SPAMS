import { authenticateDevice } from "@/lib/server/device";
import { json, readBody } from "@/lib/server/http";
import { parseTelemetry } from "@/lib/telemetry";
export async function POST(request: Request) {
  const auth = await authenticateDevice(request);
  if (auth.error) return auth.error;
  let packet;
  try {
    packet = parseTelemetry(await readBody(request));
  } catch {
    return json({ error: "Invalid telemetry payload." }, 400);
  }
  const { data, error } = await auth.client.rpc("ingest_telemetry", {
    p_gateway: auth.gatewayId,
    p_packet: packet,
  });
  if (error)
    return json(
      {
        error:
          "Telemetry rejected. Verify assignment, timestamps, capabilities and rate limits.",
      },
      422,
    );
  return json(
    { accepted: true, source: auth.source, ...data },
    data?.duplicate ? 200 : 201,
  );
}
