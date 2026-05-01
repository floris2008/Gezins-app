# Security Specification - Famly.nl

## Data Invariants
1. A user cannot have points < 0.
2. A task must belong to a household.
3. A child can only mark a task as 'pending', only a parent can mark it as 'completed' (approved).
4. Users can only see data from their own household.
5. Users cannot change their own role or points.

## The "Dirty Dozen" Payloads (Deny cases)
1. **Identity Spoofing**: User A tries to create a profile with User B's UID.
2. **Privilege Escalation**: Child tries to update their own role to 'parent'.
3. **Point Injection**: Child tries to increment their own points.
4. **Household Hijack**: User tries to join a household by changing their `householdId` to one they don't belong to.
5. **Cross-Household Leak**: User tries to read tasks from a different `householdId`.
6. **Self-Approval**: Child tries to update a task status directly to 'completed' (skipping 'pending').
7. **Reward Theft**: Child tries to decrease the cost of a reward before buying it.
8. **History Forgery**: User tries to create a history entry with a manual timestamp instead of `request.time`.
9. **Notification Spam**: User tries to create notifications for a user in another household.
10. **ID Poisoning**: User tries to create a document with a 2MB string as ID.
11. **Shadow Update**: User tries to add a `isVerified: true` field to their profile.
12. **Unverified Auth**: User with `email_verified: false` tries to write any data.

## Test Runner Logic
The `firestore.rules` must reject all the above.
