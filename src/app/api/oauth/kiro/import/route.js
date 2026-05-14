import { NextResponse } from "next/server";
import { KiroService } from "@/lib/oauth/services/kiro";
import { createProviderConnection } from "@/models";

/**
 * POST /api/oauth/kiro/import
 * Import and validate refresh token from Kiro IDE
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const kiroService = new KiroService();

    // Auto-detect format: AWS Builder ID JSON vs Social Login string
    if (body.access_token && body.client_id && body.client_secret && body.refresh_token) {
      // Format: AWS Builder ID JSON (from Kiro IDE cache)
      const email = kiroService.extractEmailFromJWT(body.access_token);
      const expiresAt = body.expires_at || new Date(Date.now() + 3600 * 1000).toISOString();

      // Check for existing connection with same client_id
      const { getProviderConnections, updateProviderConnection } = await import("@/models");
      const existingConnections = await getProviderConnections("kiro");
      const existingConnection = existingConnections.find(
        conn => conn.providerSpecificData?.clientId === body.client_id
      );

      if (existingConnection) {
        // Duplicate detected - return error with existing connection info
        return NextResponse.json(
          {
            error: "Account already connected",
            details: `This AWS Builder ID account is already connected${email ? ` (${email})` : ""}`,
            existingConnection: {
              id: existingConnection.id,
              email: existingConnection.email,
              createdAt: existingConnection.createdAt,
            },
          },
          { status: 409 }
        );
      }

      // Create new connection
      const connection = await createProviderConnection({
        provider: "kiro",
        authType: "oauth",
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        expiresAt,
        email: email || null,
        providerSpecificData: {
          clientId: body.client_id,
          clientSecret: body.client_secret,
          region: body.region || "us-east-1",
          authMethod: "builder-id",
          provider: "AWS Builder ID",
        },
        testStatus: "active",
      });

      return NextResponse.json({
        success: true,
        connection: {
          id: connection.id,
          provider: connection.provider,
          email: connection.email,
        },
      });
    }

    // Format: Social Login string (legacy)
    const { refreshToken } = body;
    if (!refreshToken || typeof refreshToken !== "string") {
      return NextResponse.json(
        { error: "Refresh token is required" },
        { status: 400 }
      );
    }

    const tokenData = await kiroService.validateImportToken(refreshToken.trim());
    const email = kiroService.extractEmailFromJWT(tokenData.accessToken);

    const connection = await createProviderConnection({
      provider: "kiro",
      authType: "oauth",
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      expiresAt: new Date(Date.now() + tokenData.expiresIn * 1000).toISOString(),
      email: email || null,
      providerSpecificData: {
        profileArn: tokenData.profileArn,
        authMethod: "imported",
        provider: "Imported",
      },
      testStatus: "active",
    });

    return NextResponse.json({
      success: true,
      connection: {
        id: connection.id,
        provider: connection.provider,
        email: connection.email,
      },
    });
  } catch (error) {
    console.log("Kiro import token error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
