import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { upsertUser } from "./lib/repository.mjs";
import { pool } from "./lib/db.mjs";
import { encrypt, decrypt } from "./lib/crypto.mjs";
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          scope: "openid email profile",
          include_granted_scopes: "true",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      return (
        account?.provider === "google" &&
        Boolean(profile?.email_verified && profile?.email && profile?.sub)
      );
    },
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const user = await upsertUser({
          sub: profile.sub,
          email: profile.email,
          name: profile.name,
        });
        token.userId = user.id;
        if (account.scope?.includes("gmail.send")) {
          const old = (
            await pool().query(
              "SELECT oauth_encrypted FROM users WHERE id=$1",
              [user.id],
            )
          ).rows[0]?.oauth_encrypted;
          const previous = old ? decrypt(old) : {};
          await pool().query(
            "UPDATE users SET oauth_encrypted=$2 WHERE id=$1",
            [
              user.id,
              encrypt({
                accessToken: account.access_token,
                refreshToken: account.refresh_token || previous.refreshToken,
                expiresAt: account.expires_at,
                scope: account.scope,
              }),
            ],
          );
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      return session;
    },
  },
  pages: { signIn: "/", error: "/auth-error" },
});
