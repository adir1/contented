# contented

Contented - open-source algorithmic content suggestion for better outcomes 

## Design

This is a Fresh/Deno application that implements OAuth 2.0 authentication for
YouTube API access.

## Features

- Google OAuth 2.0 authentication flow
- Secure token storage using Deno KV
- Session management with HTTP-only cookies
- Token refresh handling
- Authentication middleware for protected routes

## Setup

1. **Environment Configuration**

   Copy `.env.example` to `.env` and fill in your Google OAuth credentials:

   ```bash
   cp .env.example .env
   ```

   Update the following values:
   - `GOOGLE_CLIENT_ID`: Your Google OAuth client ID
   - `GOOGLE_CLIENT_SECRET`: Your Google OAuth client secret
   - `OAUTH_REDIRECT_URI`: Your OAuth redirect URI (default:
     http://localhost:8000/api/auth/callback)

2. **Google OAuth Setup**

   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the YouTube Data API v3
   - Create OAuth 2.0 credentials (Web application)
   - Add your redirect URI to the authorized redirect URIs

3. **Run the Application**

   ```bash
   deno task start
   ```

   The application will be available at http://localhost:8000

## API Endpoints

### Authentication Routes

- `GET /api/auth/login` - Initiates OAuth flow
- `GET /api/auth/callback` - OAuth callback handler
- `POST /api/auth/logout` - Logs out user and clears session
- `GET /api/auth/status` - Returns current authentication status

### Test Routes

- `GET /api/test/protected` - Protected route that requires authentication

## Usage

1. Visit http://localhost:8000
2. Click "Login with Google" to start the OAuth flow
3. Grant permissions for YouTube access
4. You'll be redirected back with authentication status
5. Use "Check Status" to verify your authentication
6. Use "Logout" to clear your session

## Architecture

- **Frontend**: Preact with Fresh SSR
- **Backend**: Fresh API routes with Deno runtime
- **Database**: Deno KV for session and token storage
- **Authentication**: Google OAuth 2.0 with YouTube readonly scope

## Security Features

- CSRF protection with state parameter
- HTTP-only secure cookies
- Automatic token refresh
- Session expiration handling
- Secure token storage in Deno KV

## Development

To check types:

```bash
deno check lib/oauth.ts lib/auth-middleware.ts
```

To run with file watching:

```bash
deno task start
```
