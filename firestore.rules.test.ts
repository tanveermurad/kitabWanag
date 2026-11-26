/**
 * Dirty Dozen Security Test Specification for KitabWanag Firestore Rules.
 * Intended for verification against Firebase Rules Emulator (@firebase/rules-unit-testing).
 */

export const DIRTY_DOZEN_CASES = [
  {
    name: 'Unverified email blocked from creating book',
    path: 'books/bk_unverified',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'Identity spoofing blocked on book create',
    path: 'books/bk_spoof',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'Shadow ghost field blocked via keys().hasOnly',
    path: 'books/bk_ghost',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'Client timestamp forgery blocked',
    path: 'books/bk_time',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'Owner reassignment blocked on book update',
    path: 'books/bk_101',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'Non-owner book deletion blocked',
    path: 'books/bk_101',
    operation: 'delete',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'Cross-user PII read on private/info blocked',
    path: 'users/usr_other/private/info',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'Blanket users collection list blocked',
    path: 'users',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'Orphan review without parent book blocked',
    path: 'books/missing_book/reviews/rev_1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'Self-request or owner mismatch blocked',
    path: 'requests/req_bad',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'Terminal request status modification blocked',
    path: 'requests/req_accepted',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'Malformed document ID rejected by isValidId',
    path: 'books/bad id!',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'Currently-reading review without valid currentPage or with currentPage > totalPages blocked',
    path: 'books/bk_101/reviews/rev_bad_page',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'Non-author review progress update blocked',
    path: 'books/bk_101/reviews/rev_301',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
  },
] as const;
