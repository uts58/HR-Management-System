// Liveness endpoint used by the Docker HEALTHCHECK and the reverse proxy.
// Created by Platform. Keep it cheap: no database access here.
export function GET() {
  return Response.json({ status: "ok" });
}
