import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async (request: VercelRequest, response: VercelResponse) => {
  return response.status(200).json({
    message: "Hello from GitHub Project Status Viewer API",
    timestamp: new Date().toISOString(),
  });
};
