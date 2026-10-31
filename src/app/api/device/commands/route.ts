import { authenticateDevice } from "@/lib/server/device";
import { json } from "@/lib/server/http";
// POST because claiming a command changes its durable delivery state.
export async function POST(request: Request) {
  const auth = await authenticateDevice(request);
  if (auth.error) return auth.error;
  const { data, error } = await auth.client.rpc("claim_pump_commands", {
    p_gateway: auth.gatewayId,
  });
  return error
    ? json({ error: "Command delivery unavailable." }, 503)
    : json({ commands: data });
}
