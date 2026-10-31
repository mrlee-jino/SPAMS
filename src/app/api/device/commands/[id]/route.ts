import { authenticateDevice } from "@/lib/server/device";
import { json, readBody } from "@/lib/server/http";
import { isUuid } from "@/lib/telemetry";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateDevice(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!isUuid(id)) return json({ error: "Invalid command." }, 400);
  let status;
  try {
    const body = await readBody(request, 2048);
    status = (body as { status?: unknown })?.status;
    if (!["acknowledged", "completed", "rejected"].includes(String(status)))
      throw new Error();
  } catch {
    return json({ error: "Invalid acknowledgment." }, 400);
  }
  const { data, error } = await auth.client.rpc("acknowledge_pump_command", {
    p_gateway: auth.gatewayId,
    p_command: id,
    p_status: status,
  });
  return error
    ? json(
        { error: "Acknowledgment rejected: verify command, state and expiry." },
        409,
      )
    : json({ command: data });
}
