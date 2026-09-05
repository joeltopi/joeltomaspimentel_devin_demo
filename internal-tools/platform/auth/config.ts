import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { rawDb } from "@platform/db/raw";
import { isRole, type Role } from "@platform/permissions/roles";

const entraId = process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
const entraSecret = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;
const entraIssuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER;

/**
 * Demo sign-in: pick a seeded user, no password. Real deployments use the Entra
 * provider below, which is registered only when its credentials are present.
 */
const credentials = Credentials({
  id: "demo",
  name: "Demo user",
  credentials: { email: { label: "Email", type: "text" } },
  async authorize(input) {
    const email = typeof input?.email === "string" ? input.email : null;
    if (!email) return null;
    const user = await rawDb.user.findUnique({ where: { email } });
    if (!user) return null;
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  },
});

const providers: NextAuthConfig["providers"] = [credentials];

if (entraId && entraSecret) {
  providers.push(
    MicrosoftEntraID({
      clientId: entraId,
      clientSecret: entraSecret,
      issuer: entraIssuer,
    }),
  );
}

export const authConfig: NextAuthConfig = {
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "microsoft-entra-id" || !user.email) return true;
      const existing = await rawDb.user.findUnique({ where: { email: user.email } });
      if (!existing) {
        await rawDb.user.create({
          data: { name: user.name ?? user.email, email: user.email, role: "viewer" },
        });
      }
      return true;
    },
    async jwt({ token, user }) {
      const email = user?.email ?? token.email;
      if (!email) return token;
      const record = await rawDb.user.findUnique({ where: { email } });
      if (record) {
        token.sub = record.id;
        token.name = record.name;
        token.email = record.email;
        token.role = record.role;
      }
      return token;
    },
    async session({ session, token }) {
      const role: Role = isRole(String(token.role)) ? (token.role as Role) : "viewer";
      session.user = {
        ...session.user,
        id: String(token.sub ?? ""),
        name: String(token.name ?? ""),
        email: String(token.email ?? ""),
        role,
      };
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
