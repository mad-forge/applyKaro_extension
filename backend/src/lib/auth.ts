import type { NextRequest } from "next/server"

export const getUserIdFromRequest = (request: NextRequest): string => {
  const userId = request.headers.get("x-user-id") || process.env.DEFAULT_USER_ID || ""

  if (!userId) {
    throw new Error("Missing x-user-id header")
  }

  return userId
}
