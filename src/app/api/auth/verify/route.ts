import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_ROLES = ["employee", "manager", "admin"] as const;
type ValidRole = (typeof VALID_ROLES)[number];

function isValidRole(r: unknown): r is ValidRole {
  return typeof r === "string" && VALID_ROLES.includes(r as ValidRole);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body?.idToken) {
      return NextResponse.json({ error: "No token provided" }, { status: 400 });
    }
    const { idToken, name: clientName, role: requestedRole, department: requestedDept } = body;

    let decoded;
    try {
      const { adminAuth } = await import("@/lib/firebase-admin");
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch (firebaseError: unknown) {
      const msg = firebaseError instanceof Error ? firebaseError.message : String(firebaseError);
      console.error("Firebase Admin verify failed:", msg);
      return NextResponse.json(
        { error: `Firebase verification failed: ${msg}` },
        { status: 401 }
      );
    }

    const { uid, email, name: firebaseName } = decoded;
    const name = clientName || firebaseName;

    const supabase = createAdminClient();

    let user;
    try {
      const { data: existingUser, error: fetchError } = await supabase
        .from("users")
        .select("*")
        .eq("firebase_uid", uid)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        console.error("Supabase fetch error:", fetchError);
        return NextResponse.json(
          { error: `Database error: ${fetchError.message}. Have you run the schema.sql in Supabase SQL Editor?` },
          { status: 500 }
        );
      }

      user = existingUser;
    } catch (dbError: unknown) {
      const msg = dbError instanceof Error ? dbError.message : String(dbError);
      console.error("Supabase connection error:", msg);
      return NextResponse.json(
        { error: `Database connection failed: ${msg}` },
        { status: 500 }
      );
    }

    if (user) {
      if (isValidRole(requestedRole) && requestedRole !== user.role) {
        return NextResponse.json(
          {
            error: "ROLE_MISMATCH",
            message: `This account is registered as "${user.role}". Please use the ${user.role} portal to sign in.`,
            actualRole: user.role,
          },
          { status: 409 }
        );
      }

      const response = NextResponse.json({ user });
      setCookies(response, idToken, user.role);
      return response;
    }

    const role: ValidRole = isValidRole(requestedRole) ? requestedRole : "employee";
    const designationMap: Record<string, string> = {
      employee: "Employee",
      manager: "Manager",
      admin: "Administrator",
    };

    try {
      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert({
          firebase_uid: uid,
          email: email || "",
          name: name || email?.split("@")[0] || "User",
          role,
          department: requestedDept || "Unassigned",
          designation: designationMap[role] || "Employee",
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          const { data: raceUser } = await supabase
            .from("users")
            .select("*")
            .eq("firebase_uid", uid)
            .single();

          if (raceUser) {
            const response = NextResponse.json({ user: raceUser });
            setCookies(response, idToken, raceUser.role);
            return response;
          }
        }
        console.error("Supabase insert error:", insertError);
        return NextResponse.json(
          { error: `Failed to create user: ${insertError.message}. Have you run the schema.sql in Supabase SQL Editor?` },
          { status: 500 }
        );
      }
      user = newUser;
    } catch (insertErr: unknown) {
      const msg = insertErr instanceof Error ? insertErr.message : String(insertErr);
      console.error("User creation error:", msg);
      return NextResponse.json(
        { error: `User creation failed: ${msg}` },
        { status: 500 }
      );
    }

    const response = NextResponse.json({ user });
    setCookies(response, idToken, user.role);
    return response;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Auth verification unexpected error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function setCookies(response: NextResponse, idToken: string, role: string) {
  response.cookies.set("firebase-token", idToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60,
    path: "/",
  });

  response.cookies.set("user-role", role, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60,
    path: "/",
  });
}
