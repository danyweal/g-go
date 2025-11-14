// types/next-auth.d.ts
import NextAuth, { DefaultSession } from 'next-auth';

// psanw full app/types/next-auth.d.ts
import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      role?: "admin" | "editor" | "member" | string;
    } & DefaultSession["user"];
  }
}


declare module 'next-auth/jwt' {
  interface JWT {
    role?: 'admin' | 'user';
  }
}
