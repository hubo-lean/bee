# Story 1.3: Authentication & User Registration

## Status

**Ready for Review**

---

## Story

**As a** user,
**I want** to sign up and log into Bee with my email and password,
**So that** I can securely access my personal knowledge management system.

---

## Acceptance Criteria

1. User can register with name, email, password (min 8 characters)
2. User can log in with email/password credentials
3. NextAuth.js v5 configured with Credentials provider and JWT sessions
4. Optional Google OAuth for app login (gracefully hidden if not configured)
5. Session persists across refreshes, accessible via `auth()` and `useSession()`
6. Protected routes redirect unauthenticated users to `/login`
7. Password hashing with bcrypt and strength validation

---

## Tasks / Subtasks

- [x] **Task 1: Install Authentication Dependencies** (AC: 3)
  - [x] Install `next-auth@beta` (v5/Auth.js)
  - [x] Install `@auth/prisma-adapter`
  - [x] Install `bcryptjs` and `@types/bcryptjs`
  - [x] Generate NEXTAUTH_SECRET using `openssl rand -base64 32`
  - [x] Update `.env.local` with NextAuth config
  - [x] Update `.env.example` to document auth environment variables

- [x] **Task 2: Update Prisma Schema for Auth** (AC: 1, 3)
  - [x] Add `passwordHash` field to User model
  - [x] Add `Account` model for OAuth providers
  - [x] Add `Session` model (for adapter compatibility)
  - [x] Add `VerificationToken` model
  - [x] Run `pnpm db:generate` to update Prisma client
  - [x] Run `pnpm db:push` to apply schema changes

- [x] **Task 3: Create Password Utilities** (AC: 7)
  - [x] Create `apps/web/src/lib/password.ts`
  - [x] Implement `hashPassword()` with bcrypt (12 rounds)
  - [x] Implement `verifyPassword()` for login
  - [x] Implement `validatePasswordStrength()` (min 8 chars)

- [x] **Task 4: Create NextAuth Configuration** (AC: 3, 4, 5)
  - [x] Create `apps/web/src/lib/auth.ts` with NextAuth config
  - [x] Configure Credentials provider for email/password
  - [x] Configure optional Google OAuth provider (if env vars present)
  - [x] Configure Prisma adapter
  - [x] Configure JWT strategy with 30-day session max age
  - [x] Implement `jwt` callback to store userId
  - [x] Implement `session` callback to expose user ID
  - [x] Add TypeScript type augmentation for Session

- [x] **Task 5: Create Auth API Route Handlers** (AC: 3)
  - [x] Create `apps/web/src/app/api/auth/[...nextauth]/route.ts`
  - [x] Export GET and POST handlers from auth config

- [x] **Task 6: Create Registration Endpoint** (AC: 1)
  - [x] Create `apps/web/src/app/api/auth/register/route.ts`
  - [x] Validate input with Zod schema
  - [x] Check email uniqueness
  - [x] Hash password before storage
  - [x] Create user with default settings
  - [x] Return success response (no sensitive data)

- [x] **Task 7: Create Login Page** (AC: 2, 4)
  - [x] Create `apps/web/src/app/login/page.tsx`
  - [x] Add email and password form fields
  - [x] Handle credentials sign-in with `signIn("credentials")`
  - [x] Show error messages for invalid credentials
  - [x] Add optional Google OAuth button (if configured)
  - [x] Redirect to dashboard on success

- [x] **Task 8: Create Registration Page** (AC: 1)
  - [x] Create `apps/web/src/app/register/page.tsx`
  - [x] Add name, email, password, confirm password fields
  - [x] Validate password match on client
  - [x] Call registration API endpoint
  - [x] Auto-login after successful registration
  - [x] Link to login page

- [x] **Task 9: Create Session Provider** (AC: 5)
  - [x] Create `apps/web/src/app/providers.tsx` with SessionProvider
  - [x] Update `apps/web/src/app/layout.tsx` to wrap app with Providers

- [x] **Task 10: Create Auth Middleware** (AC: 6)
  - [x] Create `apps/web/middleware.ts` using auth wrapper
  - [x] Define public routes: `/`, `/login`, `/register`
  - [x] Allow `/api/auth/*` routes without auth
  - [x] Redirect authenticated users from auth pages to `/dashboard`
  - [x] Redirect unauthenticated users to `/login` for protected routes

- [x] **Task 11: Create Sign Out Component** (AC: 5)
  - [x] Create `apps/web/src/components/auth/sign-out-button.tsx`
  - [x] Implement sign out with redirect to `/login`

- [x] **Task 12: Add shadcn/ui Components** (AC: 1, 2)
  - [x] Run `pnpm dlx shadcn@latest add input` in apps/web
  - [x] Run `pnpm dlx shadcn@latest add label` in apps/web
  - [x] Run `pnpm dlx shadcn@latest add alert` in apps/web

- [x] **Task 13: Testing & Verification** (AC: 1-7)
  - [x] Run `pnpm dev` and navigate to `/register`
  - [x] Register new user with valid credentials
  - [x] Verify redirect to dashboard after registration
  - [x] Check database for new User record with hashed password
  - [x] Sign out and navigate to `/login`
  - [x] Log in with registered credentials
  - [x] Verify session persists on page refresh
  - [x] Try accessing `/dashboard` while logged out - verify redirect
  - [x] Try wrong password - verify generic error message
  - [x] Run `pnpm typecheck` - verify no errors
  - [x] Run `pnpm lint` - verify no errors

---

## Dev Notes

### Architecture Change Notice

**Important:** This story implements **app authentication** - how users log into Bee itself. This is **separate** from service connections (email/calendar providers), which are handled in Story 1.5.

The authentication architecture separates concerns:
1. **App Authentication (this story)**: Email/password login to Bee, with optional Google OAuth
2. **Service Authentication (Story 1.5)**: Connecting email/calendar providers via IMAP or OAuth

### Previous Story Context (Story 1.2)

Story 1.2 established:
- Prisma schema with base `User` model
- Database connection via Supabase
- Prisma client singleton in `packages/db/src/index.ts`

**Key Context:** User model exists but needs `passwordHash` field for credentials auth.

### Tech Stack for This Story

| Technology | Version | Purpose |
|------------|---------|---------|
| NextAuth.js | 5.x (Auth.js) | Authentication framework |
| bcryptjs | latest | Password hashing |
| Zod | 3.x | Input validation |
| shadcn/ui | latest | Form components |

### Key Code: lib/auth.ts

```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@packages/db";
import { verifyPassword } from "./password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await verifyPassword(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) {
          return null;
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    // Optional Google OAuth
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string;
    };
  }
}
```

### Key Code: lib/password.ts

```typescript
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }
  return { valid: errors.length === 0, errors };
}
```

### Key Code: middleware.ts

```typescript
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const publicRoutes = ["/login", "/register", "/"];
const authRoutes = ["/login", "/register"];

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const path = req.nextUrl.pathname;

  const isPublicRoute = publicRoutes.includes(path);
  const isAuthRoute = authRoutes.includes(path);
  const isApiAuthRoute = path.startsWith("/api/auth");

  if (isApiAuthRoute) {
    return NextResponse.next();
  }

  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (!isLoggedIn && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

### Prisma Schema Additions

```prisma
model User {
  id                    String    @id @default(uuid())
  email                 String    @unique
  name                  String
  passwordHash          String?   // For email/password auth
  avatarUrl             String?
  settings              Json      @default("{}")
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  // Auth relations
  accounts              Account[]
  sessions              Session[]
  // ... existing relations ...
}

model Account {
  id                String  @id @default(uuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(uuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

### Environment Variables

```bash
# App Authentication (NextAuth.js)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Optional: Google OAuth (for app login convenience)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED="true"
```

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/web/src/lib/auth.ts` | Create | NextAuth configuration |
| `apps/web/src/lib/password.ts` | Create | Password hashing utilities |
| `apps/web/src/app/api/auth/[...nextauth]/route.ts` | Create | Auth API handlers |
| `apps/web/src/app/api/auth/register/route.ts` | Create | Registration endpoint |
| `apps/web/middleware.ts` | Create | Route protection |
| `apps/web/src/app/login/page.tsx` | Create | Login page |
| `apps/web/src/app/register/page.tsx` | Create | Registration page |
| `apps/web/src/app/providers.tsx` | Create | Session provider wrapper |
| `apps/web/src/app/layout.tsx` | Modify | Wrap with providers |
| `apps/web/src/components/auth/sign-out-button.tsx` | Create | Sign out component |
| `packages/db/prisma/schema.prisma` | Modify | Add passwordHash, Account, Session, VerificationToken |
| `.env.local` | Update | Add auth env vars |
| `.env.example` | Update | Document auth env vars |

### Security Considerations

- **Password hashing**: bcrypt with 12 salt rounds
- **No user enumeration**: Same error message for invalid email or password
- **HttpOnly cookies**: Session tokens not accessible via JavaScript
- **HTTPS in production**: Required for secure cookies

---

## Testing

### Manual Testing Checklist

1. **Registration Flow**
   - [ ] Navigate to `/register`
   - [ ] Fill out form with valid data
   - [ ] Should create account and redirect to dashboard
   - [ ] Check database for new user record with hashed password

2. **Login Flow**
   - [ ] Navigate to `/login`
   - [ ] Enter valid credentials
   - [ ] Should redirect to dashboard
   - [ ] Session should persist on refresh

3. **Invalid Credentials**
   - [ ] Try logging in with wrong password
   - [ ] Should show generic error message
   - [ ] Should NOT reveal if email exists

4. **Protected Routes**
   - [ ] Log out
   - [ ] Try accessing `/dashboard`
   - [ ] Should redirect to `/login`

5. **Session Management**
   - [ ] Log in
   - [ ] Check session in browser dev tools
   - [ ] Sign out
   - [ ] Verify session cleared

### Verification Commands

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Verify TypeScript
pnpm typecheck

# Verify linting
pnpm lint

# Start dev server
pnpm dev
```

---

## Definition of Done

- [x] All acceptance criteria met
- [x] Users can register with email/password
- [x] Users can log in with email/password
- [x] Sessions persist across browser refreshes
- [x] Protected routes redirect unauthenticated users
- [x] Sign out clears session completely
- [x] Password hashing uses bcrypt with 12 rounds
- [x] No security vulnerabilities (user enumeration, etc.)
- [x] No TypeScript errors (`pnpm typecheck`)
- [x] No ESLint errors (`pnpm lint`)
- [x] Environment variables documented in `.env.example`

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-11 | 1.0 | Initial story creation with Microsoft OAuth | Bob (SM) |
| 2026-01-11 | 2.0 | Updated to email/password auth with optional Google OAuth | Bob (SM) |

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

No debug issues encountered.

### Completion Notes List

- All authentication code implemented with email/password credentials flow
- Optional Google OAuth configured (hidden if env vars not set)
- TypeScript and ESLint checks pass
- Database schema pushed successfully to Supabase
- All manual tests passed: register, login, logout, protected routes, session persistence
- Created placeholder dashboard page for testing protected routes
- Fixed JWT callback to properly store user data (name, email) in token
- Added `apps/web/.env.local` for NextAuth secret (was missing initially)

### File List

| File | Action |
|------|--------|
| `apps/web/package.json` | Modified - added next-auth, @auth/prisma-adapter, bcryptjs, zod |
| `apps/web/src/lib/auth.ts` | Created |
| `apps/web/src/lib/password.ts` | Created |
| `apps/web/src/app/api/auth/[...nextauth]/route.ts` | Created |
| `apps/web/src/app/api/auth/register/route.ts` | Created |
| `apps/web/src/app/login/page.tsx` | Created |
| `apps/web/src/app/register/page.tsx` | Created |
| `apps/web/src/app/dashboard/page.tsx` | Created |
| `apps/web/src/app/providers.tsx` | Created |
| `apps/web/src/app/layout.tsx` | Modified - wrapped with Providers |
| `apps/web/middleware.ts` | Created |
| `apps/web/src/components/auth/sign-out-button.tsx` | Created |
| `apps/web/src/components/ui/input.tsx` | Created (shadcn) |
| `apps/web/src/components/ui/label.tsx` | Created (shadcn) |
| `apps/web/src/components/ui/alert.tsx` | Created (shadcn) |
| `packages/db/prisma/schema.prisma` | Modified - added passwordHash, Account, Session, VerificationToken |
| `.env.example` | Modified - documented auth env vars |
| `apps/web/.env.local` | Created - NextAuth secret and DB credentials |
| `packages/db/.env` | Created - DB credentials for Prisma |
| `apps/web/src/app/page.tsx` | Modified - redirect authenticated users to dashboard |

---

## QA Results

**QA Status: PASSED**

| Verification | Result |
|--------------|--------|
| `pnpm db:generate` | ✅ Prisma Client v5.22.0 generated with auth models |
| `pnpm typecheck` | ✅ All 3 packages pass |
| `pnpm lint` | ✅ No ESLint errors |
| Prisma schema | ✅ 15 models (12 original + Account, Session, VerificationToken) |
| User.passwordHash | ✅ Field added for credentials auth |
| NextAuth config | ✅ JWT strategy, 30-day session, Credentials + optional Google |
| Password utilities | ✅ bcrypt 12 rounds, validatePasswordStrength |
| Middleware | ✅ Public routes, auth routes, protected routes logic |
| Registration API | ✅ Zod validation, email uniqueness, hash before store |
| Login page | ✅ Credentials form, optional Google button, error handling |
| Register page | ✅ Name/email/password/confirm, auto-login after register |
| SessionProvider | ✅ Wraps app in providers.tsx |
| SignOutButton | ✅ Client component with redirect to /login |
| Dashboard page | ✅ Server component with auth() check |
| shadcn components | ✅ Input, Label, Alert added |
| .env.example | ✅ NEXTAUTH_URL, NEXTAUTH_SECRET, optional Google vars |

### Security Review
- ✅ Generic error message "Invalid email or password" prevents user enumeration
- ✅ bcrypt 12 salt rounds for password hashing
- ✅ JWT strategy with httpOnly cookies
- ✅ Zod validation on registration input

### Files Verified (19 total)
- Auth: lib/auth.ts, lib/password.ts, middleware.ts
- API: api/auth/[...nextauth]/route.ts, api/auth/register/route.ts
- Pages: login/page.tsx, register/page.tsx, dashboard/page.tsx
- Components: providers.tsx, sign-out-button.tsx, ui/input.tsx, ui/label.tsx, ui/alert.tsx
- Config: schema.prisma (modified), .env.example (modified)

**QA Agent:** Claude Opus 4.5
**Date:** 2026-01-11
