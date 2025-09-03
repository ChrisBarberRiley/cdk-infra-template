export const handler = async (event: any) => {
  if (
    event?.requestContext?.http?.method === "GET" &&
    event?.rawPath === "/health"
  ) {
    return { statusCode: 200, body: "ok" };
  }
  return { statusCode: 200, body: "ready" };
};
