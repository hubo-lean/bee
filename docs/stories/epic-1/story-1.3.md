# Story 1.3: Authentication with Microsoft

## Story Overview

| Field | Value |
|-------|-------|
| **Story ID** | 1.3 |
| **Epic** | [Epic 1: Foundation & Infrastructure](epic-1.md) |
| **Priority** | P0 - Critical Path |
| **Estimated Effort** | Medium (2-3 days) |
| **Dependencies** | Story 1.1 (Project Setup), Story 1.2 (Database) |
| **Blocks** | Stories 1.4, 1.5, all Epic 2+ stories |

## User Story

**As a** user,
**I want** to sign in with my Microsoft account,
**So that** I can access my Outlook, Calendar, and OneDrive data within Bee.

## Detailed Description

This story implements Microsoft OAuth authentication using NextAuth.js (Auth.js v5). Users will authenticate via Microsoft Entra ID (formerly Azure AD), granting Bee access to their Microsoft 365 services.

Key features:
- **Single Sign-On** with Microsoft account
- **Token storage** for API access (Outlook, Calendar, OneDrive)
- **Automatic token refresh** when tokens expire
- **Session persistence** across browser refreshes
- **Protected routes** that require authentication

## Acceptance Criteria

### AC1: Microsoft App Registration
- [ ] App registered in Microsoft Entra ID (Azure Portal)
- [ ] Redirect URIs configured for development (`http://localhost:3000/api/auth/callback/microsoft-entra-id`)
- [ ] Redirect URIs configured for production (`https://bee.domain.com/api/auth/callback/microsoft-entra-id`)
- [ ] Required API permissions configured:
  - `openid` - Sign in
  - `profile` - User profile
  - `email` - Email address
  - `User.Read` - Read user profile
  - `Calendars.ReadWrite` - Calendar access
  - `Mail.Read` - Email access
  - `Files.ReadWrite.All` - OneDrive access
- [ ] Client ID and Secret generated and documented

### AC2: NextAuth.js Configuration
- [ ] NextAuth.js v5 (Auth.js) installed
- [ ] Microsoft Entra ID provider configured
- [ ] Prisma adapter installed and connected
- [ ] Auth configuration in `lib/auth.ts`
- [ ] API route handlers in `app/api/auth/[...nextauth]/route.ts`

### AC3: OAuth Flow Works
- [ ] User clicks "Sign in with Microsoft"
- [ ] Redirected to Microsoft login page
- [ ] After login, redirected back to app
- [ ] User record created in database (first login)
- [ ] User record retrieved on subsequent logins
- [ ] Access and refresh tokens stored securely

### AC4: Session Management
- [ ] Session persists across browser refreshes
- [ ] Session accessible via `auth()` server function
- [ ] Session accessible via `useSession()` client hook
- [ ] Session includes user ID, email, name
- [ ] Session expires after configured time (30 days default)

### AC5: Token Refresh
- [ ] Access token refreshed automatically when expired
- [ ] Refresh logic in NextAuth callbacks
- [ ] Token refresh errors handled gracefully
- [ ] User prompted to re-authenticate if refresh fails

### AC6: Sign Out
- [ ] Sign out button clears session
- [ ] User redirected to login page
- [ ] Tokens cleared from session
- [ ] User cannot access protected routes after sign out

### AC7: Protected Routes
- [ ] Middleware protects authenticated routes
- [ ] Unauthenticated users redirected to `/login`
- [ ] Login page accessible without authentication
- [ ] API routes protected from unauthenticated requests

## Technical Implementation Notes

### File: `lib/auth.ts`
```typescript
import NextAuth from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@packages/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    MicrosoftEntraID({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid profile email User.Read Calendars.ReadWrite Mail.Read Files.ReadWrite.All offline_access',
        },
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, account, user }) {
      // Initial sign in - store tokens
      if (account && user) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
          userId: user.id,
        };
      }

      // Return token if not expired (with 5 min buffer)
      if (Date.now() < ((token.expiresAt as number) * 1000 - 5 * 60 * 1000)) {
        return token;
      }

      // Token expired - refresh it
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.user.id = token.userId as string;
      session.accessToken = token.accessToken as string;
      session.error = token.error as string | undefined;
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
});

async function refreshAccessToken(token: any) {
  try {
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
        scope: 'openid profile email User.Read Calendars.ReadWrite Mail.Read Files.ReadWrite.All offline_access',
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    console.log('Token refreshed successfully');

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
      expiresAt: Math.floor(Date.now() / 1000 + refreshedTokens.expires_in),
    };
  } catch (error) {
    console.error('Error refreshing access token:', error);
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}

// Type augmentation for session
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string;
    };
    accessToken?: string;
    error?: string;
  }
}
```

### File: `app/api/auth/[...nextauth]/route.ts`
```typescript
import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
```

### File: `middleware.ts`
```typescript
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith('/login');
  const isApiAuthRoute = req.nextUrl.pathname.startsWith('/api/auth');
  const isPublicRoute = req.nextUrl.pathname === '/';

  // Allow auth API routes
  if (isApiAuthRoute) {
    return NextResponse.next();
  }

  // Redirect logged-in users away from login page
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Redirect unauthenticated users to login
  if (!isLoggedIn && !isAuthPage && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### File: `app/login/page.tsx`
```typescript
import { auth, signIn } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default async function LoginPage() {
  const session = await auth();

  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900">Bee</h1>
          <p className="mt-2 text-gray-600">
            Your unified command center for knowledge and action
          </p>
        </div>

        <form
          action={async () => {
            'use server';
            await signIn('microsoft-entra-id', { redirectTo: '/dashboard' });
          }}
        >
          <Button type="submit" className="w-full" size="lg">
            Sign in with Microsoft
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500">
          Sign in with your Microsoft 365 account to connect your email, calendar, and files.
        </p>
      </div>
    </div>
  );
}
```

### File: `components/auth/sign-out-button.tsx`
```typescript
'use client';

import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export function SignOutButton() {
  return (
    <Button
      variant="ghost"
      onClick={() => signOut({ callbackUrl: '/login' })}
    >
      Sign out
    </Button>
  );
}
```

### File: `app/providers.tsx`
```typescript
'use client';

import { SessionProvider } from 'next-auth/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  );
}
```

### Prisma Schema Addition for NextAuth
Add to `packages/db/prisma/schema.prisma`:
```prisma
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

// Update User model to add relations
model User {
  // ... existing fields ...
  accounts          Account[]
  sessions          Session[]
}
```

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `lib/auth.ts` | Create | NextAuth configuration |
| `app/api/auth/[...nextauth]/route.ts` | Create | Auth API handlers |
| `middleware.ts` | Create | Route protection |
| `app/login/page.tsx` | Create | Login page |
| `app/providers.tsx` | Create | Session provider wrapper |
| `app/layout.tsx` | Modify | Wrap with providers |
| `components/auth/sign-out-button.tsx` | Create | Sign out component |
| `packages/db/prisma/schema.prisma` | Modify | Add NextAuth models |
| `.env.local` | Update | Add Microsoft credentials |
| `.env.example` | Update | Document auth env vars |

## Environment Variables Required

```bash
# Microsoft OAuth
MICROSOFT_CLIENT_ID="your-client-id-from-azure"
MICROSOFT_CLIENT_SECRET="your-client-secret-from-azure"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
```

## Microsoft Azure Setup Steps

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Microsoft Entra ID** > **App registrations**
3. Click **New registration**
   - Name: `Bee`
   - Supported account types: `Accounts in any organizational directory and personal Microsoft accounts`
   - Redirect URI: `Web` - `http://localhost:3000/api/auth/callback/microsoft-entra-id`
4. After creation, note the **Application (client) ID**
5. Go to **Certificates & secrets** > **New client secret**
   - Note the secret value (only shown once!)
6. Go to **API permissions** > **Add a permission** > **Microsoft Graph**
   - Add: `openid`, `profile`, `email`, `User.Read`, `Calendars.ReadWrite`, `Mail.Read`, `Files.ReadWrite.All`, `offline_access`
7. Click **Grant admin consent** (if you have admin access)

## Testing Requirements

### Manual Testing
1. Start dev server: `pnpm dev`
2. Navigate to `http://localhost:3000` - should redirect to `/login`
3. Click "Sign in with Microsoft"
4. Complete Microsoft OAuth flow
5. Should redirect to `/dashboard` after login
6. Refresh page - session should persist
7. Check database - User and Account records created
8. Click sign out - should redirect to login
9. Try accessing `/dashboard` - should redirect to login

### Edge Cases to Test
1. **Token expiry**: Wait for token to expire, verify refresh works
2. **Invalid refresh token**: Manually invalidate token, verify re-auth prompt
3. **Cancelled OAuth**: Cancel during Microsoft login, verify error handling
4. **Multiple tabs**: Sign in on one tab, verify session syncs to other tabs

### Verification Commands
```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Verify session in browser console
console.log(await fetch('/api/auth/session').then(r => r.json()))
```

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Microsoft app registered with correct permissions
- [ ] OAuth flow completes successfully
- [ ] User created in database on first login
- [ ] Session persists across page refreshes
- [ ] Token refresh works when token expires
- [ ] Sign out clears session completely
- [ ] Protected routes redirect unauthenticated users
- [ ] No sensitive data in client-side code
- [ ] Environment variables documented

## Security Considerations

- **Never log tokens**: Access/refresh tokens should never appear in logs
- **HTTPS in production**: OAuth requires HTTPS for redirect URIs
- **Secure cookie settings**: NextAuth handles this, but verify in production
- **Token encryption**: Tokens stored in JWT are encrypted with NEXTAUTH_SECRET
- **Minimal scopes**: Only request permissions actually needed

## Notes & Decisions

- **JWT strategy over database sessions**: Simpler, no session table lookups on every request
- **30-day session**: Balance between security and UX - users don't want to login daily
- **Automatic token refresh**: Seamless UX - user never sees token expiry
- **`offline_access` scope**: Required to get refresh tokens from Microsoft

## Related Documentation

- [Architecture Document](../../architecture.md) - Auth flow diagrams
- [NextAuth.js Docs](https://next-auth.js.org/) - Official documentation
- [Microsoft Identity Docs](https://docs.microsoft.com/en-us/azure/active-directory/develop/) - OAuth setup
