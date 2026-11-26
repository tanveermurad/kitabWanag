# KitabWanag Firestore Security Specification

## 1. Data Invariants
1. Public reader profiles (`/users/{userId}`) contain only non-PII display fields (`id`, `name`, `city`, `createdAt`, `updatedAt`); email addresses are isolated in `/users/{userId}/private/info` readable only by the owning user.
2. A `BookListing` (`/books/{bookId}`) can only be created by a verified user (`email_verified == true`) with `ownerId == request.auth.uid`, valid coordinate bounds, and server-verified `createdAt == request.time`.
3. A `BookReview` or `BookQuestion` cannot exist without a valid parent `BookListing` verified via `exists(/databases/$(database)/documents/books/$(bookId))`.
4. A `BookAnswer` cannot exist without a valid parent `BookQuestion` verified via `exists(...)`.
5. A `BookRequest` (`/requests/{requestId}`) can only be read by `ownerId` or `requesterId`, created with `status == 'Pending'` and `ownerId != request.auth.uid` matching the parent book's owner, and transitioned once from `'Pending'` to `'Accepted'` or `'Declined'` solely by `ownerId`.

## 2. Dirty Dozen Payloads (Expected PERMISSION_DENIED)
1. **Unverified email write**: Creating a `/books/{bookId}` document when `request.auth.token.email_verified == false`.
2. **Identity spoofing on book create**: Creating `/books/{bookId}` with `ownerId: "other_uid"`.
3. **Ghost field injection**: Creating `/books/{bookId}` with an extra undeclared field `isFeatured: true`.
4. **Client timestamp forgery**: Creating `/books/{bookId}` with `createdAt` different from `request.time`.
5. **Owner reassignment on update**: Updating `/books/{bookId}` to change `ownerId` or `createdAt`.
6. **Unauthorized book deletion**: Deleting `/books/{bookId}` when `request.auth.uid != existing().ownerId`.
7. **PII leak on private user info**: Reading `/users/{otherUid}/private/info` as another authenticated user.
8. **User directory scraping**: Listing `/users` collection.
9. **Orphan review**: Creating `/books/nonexistent_book/reviews/rev_1` where parent book does not exist.
10. **Self-request bypass**: Creating `/requests/{reqId}` for one's own book (`ownerId == request.auth.uid`) or mismatched `ownerId`.
11. **Terminal state reversal**: Updating `/requests/{reqId}` from `'Accepted'` back to `'Pending'` or `'Declined'`.
12. **ID poisoning**: Creating or reading `/books/bad id with spaces...` failing `isValidId()`.
