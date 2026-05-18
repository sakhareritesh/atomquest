import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });
  const isProduction = process.env.NODE_ENV === "production";

  response.cookies.set("firebase-token", "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  response.cookies.set("user-role", "", {
    httpOnly: false,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
