# Account lifecycle

Status: implemented for 0.21.0; remote CI and release review follow patch application.

Access tokens remain memory-only and short-lived. Each login creates a database
session; authorization checks its revocation and expiry on every request. Reload
still requires login. No refresh cookies or additional browser credentials are
introduced. Password changes and resets revoke every session, including the
current one, without modifying notebook snapshots or browser recovery caches.

Verification and reset links use single-use, expiring opaque tokens. The database
stores a digest and a delivery record, never the link secret. A separate worker
reconstructs the secret with HMAC and delivers queued mail. Links use a configured
frontend URL and fragments; opening a link never consumes it. Confirmation uses
POST. Reset requests return the same response for unknown and existing addresses.

Development writes email files to an ignored outbox. Production uses authenticated
SMTP with TLS and an explicitly configured frontend URL. SMTP delivery is retried;
links expire even if delivery fails. Keep the JWT secret stable across API and
worker processes. Changing it invalidates access and outstanding email links.

Email verification is displayed but does not change existing notebook access.
Introducing mandatory verification is a separate migration/policy decision.
New passwords follow the requested minimum of five characters with uppercase,
lowercase and a digit; existing passwords remain usable for login.

References: [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) and [Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) Cheat Sheets.
