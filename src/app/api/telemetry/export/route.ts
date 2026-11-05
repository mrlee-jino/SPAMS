
import { authenticateDevice } from "@/lib/server/device";
import { json, readBody } from "@/lib/server/http";
import { parseTelemetry } from "@/lib/telemetry";

export async function POST(request: Request) {

  // 1. Authenticate the central ESP32 gateway
  const auth = await authenticateDevice(request);

  if (auth.error) {
    return auth.error;
  }

  // 2. Read and validate the incoming sensor data
  let packet;

  try {
    packet = parseTelemetry(await readBody(request));
  } catch {
    return json(
      { error: "Invalid telemetry payload." },
      400
    );
  }

  // 3. Send validated data to Supabase
  const { data, error } = await auth.client.rpc(
    "ingest_telemetry",
    {
      p_gateway: auth.gatewayId,
      p_packet: packet,
    }
  );

  // 4. Handle database errors
  if (error) {
    console.error("SPAMS telemetry ingestion failed", {
      code: error.code,
      message: error.message,
    });

    return json(
      {
        error:
          "Telemetry rejected. Verify node assignment, timestamps, sensor values and rate limits.",
      },
      422
    );
  }

  // 5. Confirm successful submission
  return json(
    {
      accepted: true,
      source: auth.source,
      ...data,
    },
    data?.duplicate ? 200 : 201
  );
}
