# ADR 0005: Private aggregates behind an independent account password

Status: accepted for 0.22.0.

## Context

An account owner can protect a section tree or a single content item with one independent privacy password. Password recovery must preserve data and must not change the account login password. A CSS blur alone would expose the underlying data through browser storage, search, accessibility, and API responses.

## Decision

Store private aggregates separately in `private_items`. Protecting an item is one database transaction: verify notebook ownership and revision, extract the content/tree, increment the public notebook revision, and insert the private aggregate. A section includes its descendants. Global reminders are not implicitly moved with a section. Public sync cannot reintroduce IDs reserved by private aggregates in the same notebook.

All private reads, edits, protection and public restoration require both a valid account session and an independent privacy grant. Grants are signed, expire after five minutes, and bind the account ID, auth session ID and privacy credential version. Changing/resetting the privacy password invalidates existing grants without changing the account password. Account logout/revocation invalidates the associated grants as well. Passwords use Argon2 hashes; setup requires a verified account email. Privacy attempts are rate limited per account.

Recovery reuses the durable account email queue with a distinct `private` purpose and independent credential version. Its links are expiring, single-use and checked against the current signing key. Opening a link is inert until explicit confirmation. No new environment secrets or runtime packages are required.

Private content is fetched only after unlocking and is not added to the public `Notebook` cache, guest notebook, search index, or automatic recovery caches. Unsaved private drafts stay in memory while locked in the same workspace; reload closes that memory. Private saves are automatic, serialized and revision checked. Navigation flushes pending edits and stays on the item if saving fails. Replacing or abandoning an unsaved draft requires a successful explicit export. The editor warns users to save/export before closing the page. Public restoration is explicit, revision checked and rejected on missing parents or conflicting/invalid content.

Privacy controls live in creation forms and per-item menus. The default displays generic locked cards alongside ordinary siblings at their original parent location; clicking a card opens a compact password prompt followed by the normal section/content page. Settings can instead select a dedicated private list. Both modes use the same editor/session and access checks; there is no second private editor. Card blur uses decorative bars, never real private text. Root/parent identifiers, sibling positions and the existence/type of private items remain visible to the authenticated owner. Private items whose parent was removed or made private remain accessible in the dedicated area.

## Security boundary and trade-offs

This is application access control, not end-to-end encryption. Private JSON remains readable to trusted database/server operators and database backups; deployers must protect PostgreSQL, backups, server credentials, TLS and the host. A person with access to an already unlocked tab can read its content. Locking removes the rendered editor, but an unsaved draft intentionally remains in JavaScript memory for same-tab recovery. This does not protect against developer tools, browser extensions with page access, XSS, or a compromised device.

Previously exported backups, other devices' earlier public caches, guest originals, or copies made before protection cannot be recalled. The UI warns before moving an item. Public backups contain only the public notebook; private items must be exported explicitly from their unlocked editor. Such exports are ordinary readable JSON and can be imported publicly by deliberate user action. Database backups include both aggregates.

Private content is account-backed and online-only in this release. Unverified accounts and guest notebooks must connect/verify before configuring protection. Display preferences are device-local; privacy credentials and content are account-wide. Existing public notebook schema 1 and storage keys remain unchanged.

## Migration and validation

Migration `20261112_04` adds nullable privacy hashes, a zero-default credential version and the private aggregate table. Existing public data is untouched. Downgrade refuses to discard private credentials or content. Test migrations on SQLite and PostgreSQL, cross-owner/session isolation, wrong passwords, expired/reused recovery links, password independence, revision conflicts, protected ID sync collisions, UI previews, browser caches and the real mail/API recovery flow.

## Interaction reformulation

Migration `20261112_05` adds a zero-default sibling position to existing private records without changing their snapshots, passwords or revisions. Existing records from migration 04 have no recoverable exact former sibling position and use zero. Newly protected/created items record their logical sibling position. Display preferences do not move database records.

New private sections/content are inserted directly into the private aggregate. They never pass through the public notebook or browser cache. Protect/create/restore responses contain the committed public snapshot so the client updates its workspace without depending on a second GET succeeding. The existing public edit/sync flow remains explicit. Privacy changes require a synchronized public workspace.

A private section protects its descendants as one aggregate; descendant privacy controls are checked and disabled. Independently protected children remain distinct, and can be opened from locked cards within their parent or the optional private list. Successful password checks clear their attempt counter; five consecutive failed unlocks are blocked for a minute. Settings/recovery actions keep a separate rate-limit bucket.
