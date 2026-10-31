import { json, readBody, sameOrigin, userClient } from "@/lib/server/http";
import { isUuid } from "@/lib/telemetry";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return json({ error: "Same-origin request required." }, 403);
  const auth = await userClient();
  if (auth.error) return auth.error;
  let input: { gatewayId: string; action: string; idempotencyKey: string };
  try {
    const body = (await readBody(request, 2048)) as Record<string, unknown>;
    if (
      !body ||
      !isUuid(body.gatewayId) ||
      !isUuid(body.idempotencyKey) ||
      !["start", "stop"].includes(String(body.action))
    )
      throw new Error();
    input = {
      gatewayId: body.gatewayId,
      action: String(body.action),
      idempotencyKey: body.idempotencyKey,
    };
  } catch {
    return json({ error: "Invalid command request." }, 400);
  }
  const { data, error } = await auth.client.rpc("request_pump_command", {
    p_gateway: input.gatewayId,
    p_action: input.action,
    p_key: input.idempotencyKey,
  });
  if (error)
    return json(
      {
        error:
          error.code === "42501"
            ? "Not authorized for this gateway."
            : "Command blocked. Check control enablement, heartbeat, battery, water levels and unresolved commands.",
      },
      error.code === "42501" ? 403 : 409,
    );
  return json({ command: data }, 201);
}
