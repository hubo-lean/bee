# Story 1.3: Authentication & User Registration

## Story Overview

| Field                | Value                                            |
| -------------------- | ------------------------------------------------ |
| **Story ID**         | 1.3                                              |
| **Epic**             | [Epic 1: Foundation & Infrastructure](epic-1.md) |
| **Priority**         | P0 - Critical Path                               |
| **Estimated Effort** | Medium (2-3 days)                                |
| **Dependencies**     | Story 1.1 (Project Setup), Story 1.2 (Database)  |
| **Blocks**           | Stories 1.4, 1.5, all Epic 2+ stories            |

## User Story

**As a** user,
**I want** to sign up and log into Bee with my email and password,
**So that** I can securely access my personal knowledge management system.

## Detailed Description

This story implements **app authentication** - how users log into Bee itself. This is **separate** from service connections (email/calendar providers), which are handled in Story 1.5.

The authentication architecture separates concerns:
1. **App Authentication (this story)**: Email/password login to Bee, with optional Google OAuth
2. **Service Authentication (Story 1.5)**: Connecting email/calendar providers via IMAP or OAuth

Key features:
- **Email/password registration and login** (primary method)
- **Optional Google OAuth** for app login convenience
- **Secure password hashing** with bcrypt
- **Session management** via NextAuth.js with JWT strategy
- **Protected routes** requiring authentication

## Acceptance Criteria

### AC1: User Registration

- [ ] Registration page at `/register`
- [ ] Registration form with: name, email, password, confirm password
- [ ] Password requirements: minimum 8 characters
- [ ] Email uniqueness validation
- [ ] Password hashed with bcrypt before storage
- [ ] User created in database on successful registration
- [ ] Auto-login after successful registration
- [ ] Error messages for validation failures

### AC2: Email/Password Login

- [ ] Login page at `/login`
- [ ] Login form with: email, password
- [ ] Credentials validated against database
- [ ] Session created on successful login
- [ ] "Remember me" option (extends session duration)
- [ ] Error message for invalid credentials (generic, no user enumeration)
- [ ] Rate limiting on login attempts (5 per minute per IP)

### AC3: NextAuth.js Configuration

- [ ] NextAuth.js v5 (Auth.js) installed and configured
- [ ] Credentials provider for email/password
- [ ] JWT session strategy (not database sessions)
- [ ] Session includes user ID, email, name
- [ ] Prisma adapter connected for user storage

### AC4: Optional Google OAuth

- [ ] Google OAuth provider configured (optional, based on env vars)
- [ ] "Sign in with Google" button on login page (if configured)
- [ ] New users auto-created on first Google login
- [ ] Existing users can link Google account
- [ ] Works without Google credentials configured (gracefully hidden)

### AC5: Session Management

- [ ] Session persists across browser refreshes
- [ ] Session accessible via `auth()` server function
- [ ] Session accessible via `useSession()` client hook
- [ ] Default session duration: 30 days
- [ ] Sign out clears session completely

### AC6: Protected Routes

- [ ] Middleware protects authenticated routes
- [ ] Unauthenticated users redirected to `/login`
- [ ] Login and register pages redirect authenticated users to `/dashboard`
- [ ] API routes return 401 for unauthenticated requests

### AC7: Password Utilities

- [ ] Password hashing utility with bcrypt
- [ ] Password verification utility
- [ ] Password strength validation

## Technical Implementation Notes

### File: `lib/auth.ts`

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
    // Primary: Email/Password login
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

    // Optional: Google OAuth for app login
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

// Type augmentation for session
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

### File: `lib/password.ts`

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

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

### File: `app/api/auth/[...nextauth]/route.ts`

```typescript
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

### File: `app/api/auth/register/route.ts`

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@packages/db";
import { hashPassword, validatePasswordStrength } from "@/lib/password";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password } = registerSchema.parse(body);

    // Check password strength
    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: passwordCheck.errors[0] },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      );
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        settings: {
          confidenceThreshold: 0.6,
          autoArchiveDays: 15,
          defaultModel: "claude",
          weeklyReviewDay: 0,
        },
      },
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "An error occurred during registration" },
      { status: 500 }
    );
  }
}
```

### File: `middleware.ts`

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

  // Allow auth API routes
  if (isApiAuthRoute) {
    return NextResponse.next();
  }

  // Redirect logged-in users away from auth pages
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Redirect unauthenticated users to login
  if (!isLoggedIn && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

### File: `app/login/page.tsx`

```typescript
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900">Bee</h1>
          <p className="mt-2 text-gray-600">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        {process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true" && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-gray-50 px-2 text-gray-500">
                  Or continue with
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                {/* Google icon SVG path */}
              </svg>
              Google
            </Button>
          </>
        )}

        <p className="text-center text-sm text-gray-600">
          Don't have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
```

### File: `app/register/page.tsx`

```typescript
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      // Auto-login after successful registration
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Registration successful but login failed. Please sign in.");
        router.push("/login");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900">Bee</h1>
          <p className="mt-2 text-gray-600">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
            />
            <p className="text-xs text-gray-500">
              Must be at least 8 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
```

### File: `components/auth/sign-out-button.tsx`

```typescript
"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

interface SignOutButtonProps {
  className?: string;
}

export function SignOutButton({ className }: SignOutButtonProps) {
  return (
    <Button
      variant="ghost"
      className={className}
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      <LogOut className="mr-2 h-4 w-4" />
      Sign out
    </Button>
  );
}
```

### Prisma Schema Addition

Add `passwordHash` field to User model in `packages/db/prisma/schema.prisma`:

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

  // ... existing relations ...
  accounts              Account[]
  sessions              Session[]
}

// NextAuth.js Account model (for OAuth providers)
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

## Files to Create/Modify

| File                              | Action | Purpose                    |
| --------------------------------- | ------ | -------------------------- |
| `lib/auth.ts`                     | Create | NextAuth configuration     |
| `lib/password.ts`                 | Create | Password hashing utilities |
| `app/api/auth/[...nextauth]/route.ts` | Create | Auth API handlers      |
| `app/api/auth/register/route.ts`  | Create | Registration endpoint      |
| `middleware.ts`                   | Create | Route protection           |
| `app/login/page.tsx`              | Create | Login page                 |
| `app/register/page.tsx`           | Create | Registration page          |
| `app/providers.tsx`               | Create | Session provider wrapper   |
| `app/layout.tsx`                  | Modify | Wrap with providers        |
| `components/auth/sign-out-button.tsx` | Create | Sign out component     |
| `packages/db/prisma/schema.prisma` | Modify | Add auth models           |
| `.env.local`                      | Update | Add auth env vars          |
| `.env.example`                    | Update | Document auth env vars     |

## Dependencies to Install

```bash
pnpm add next-auth@beta @auth/prisma-adapter bcryptjs
pnpm add -D @types/bcryptjs
```

## Environment Variables Required

```bash
# App Authentication (NextAuth.js)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Optional: Google OAuth (for app login convenience)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED="true"  # Set to enable Google button
```

## Testing Requirements

### Manual Testing

1. **Registration Flow**:
   - Navigate to `/register`
   - Fill out form with valid data
   - Should create account and redirect to dashboard
   - Check database for new user record

2. **Login Flow**:
   - Navigate to `/login`
   - Enter valid credentials
   - Should redirect to dashboard
   - Session should persist on refresh

3. **Invalid Credentials**:
   - Try logging in with wrong password
   - Should show error message
   - Should NOT reveal if email exists

4. **Protected Routes**:
   - Log out
   - Try accessing `/dashboard`
   - Should redirect to `/login`

5. **Session Management**:
   - Log in
   - Check session in browser dev tools
   - Sign out
   - Verify session cleared

### Verification Commands

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Verify password hashing in Node REPL
const bcrypt = require('bcryptjs');
const hash = await bcrypt.hash('password123', 12);
await bcrypt.compare('password123', hash); // true
```

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Users can register with email/password
- [ ] Users can log in with email/password
- [ ] Sessions persist across browser refreshes
- [ ] Protected routes redirect unauthenticated users
- [ ] Sign out clears session completely
- [ ] Password hashing uses bcrypt with 12 rounds
- [ ] No security vulnerabilities (user enumeration, etc.)
- [ ] Environment variables documented

## Security Considerations

- **Password hashing**: bcrypt with 12 salt rounds
- **No user enumeration**: Same error message for invalid email or password
- **Rate limiting**: Prevent brute force attacks (implement in next iteration)
- **HTTPS required**: In production, all auth routes must use HTTPS
- **HttpOnly cookies**: Session tokens not accessible via JavaScript

## Notes & Decisions

- **Email/password as primary**: More flexible than OAuth-only, works for users without Google accounts
- **Optional Google OAuth**: Convenience feature, not required for app functionality
- **Separate from service auth**: App login is independent of email/calendar provider connections
- **JWT strategy**: No database lookups for session validation, better performance
- **30-day sessions**: Balance between security and UX

## Related Documentation

- [Architecture Document](../../architecture.md) - Auth architecture diagrams
- [NextAuth.js Docs](https://next-auth.js.org/) - Official documentation
