import test from "node:test";
import assert from "node:assert/strict";
import { sameOrigin } from "../src/lib/request-security.ts";
const request = (headers) =>
  new Request("http://0.0.0.0:3000/api/pump-commands", { headers });
test("allows exact browser origin behind Next bind address and TLS proxy", () => {
  assert(
    sameOrigin(
      request({
        host: "localhost:3000",
        origin: "http://localhost:3000",
        "sec-fetch-site": "same-origin",
      }),
    ),
  );
  assert(
    sameOrigin(
      request({
        host: "pond.example",
        origin: "https://pond.example",
        "x-forwarded-proto": "https",
      }),
    ),
  );
});
test("rejects cross-origin, sibling subdomains, missing or malformed origin and forged forwarded host", () => {
  for (const headers of [
    {
      host: "pond.example",
      origin: "https://evil.example",
      "x-forwarded-proto": "https",
    },
    {
      host: "pond.example",
      origin: "https://pond.example",
      "x-forwarded-proto": "https",
      "sec-fetch-site": "same-site",
    },
    { host: "pond.example" },
    { host: "pond.example", origin: "null" },
    {
      host: "pond.example",
      origin: "https://evil.example",
      "x-forwarded-host": "evil.example",
      "x-forwarded-proto": "https",
    },
    {
      host: "pond.example",
      origin: "https://pond.example/path",
      "x-forwarded-proto": "https",
    },
  ])
    assert.equal(sameOrigin(request(headers)), false);
});
