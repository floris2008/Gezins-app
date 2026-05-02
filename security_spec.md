# Security Specification - family-chores

## Data Invariants
1. **Household Isolation**: Users can only see data (Tasks, Rewards, History, Notifications) belonging to their `householdId`.
2. **Role-Based Access**: Only users with `role == 'parent'` can perform administrative tasks:
    - Creating/Editing/Deleting Tasks.
    - Creating/Editing/Deleting Rewards.
3. **Identity Integrity**: `userId` or `ownerId` fields in created documents must match the `request.auth.uid`.
4. **Immutability**: `createdAt` and `householdId` (once set) should not be changed by residents.
5. **Point Integrity**: Point changes must be accompanied by a history record (atomicity not strictly enforced by rules without `existsAfter`, but we'll protect the fields).

## The Dirty Dozen (Malicious Payloads)

1. **Identity Spoofing**: Attempt to create a user profile with a different `auth.uid`.
2. **Privilege Escalation**: A user with `role: 'child'` attempts to update their own role to `'parent'`.
3. **Cross-Household Data Leak**: A user in household A attempts to read a task from household B.
4. **Unauthenticated Write**: An unauthenticated user attempts to create a household.
5. **Unauthorized Task Deletion**: A user with `role: 'child'` attempts to delete a task.
6. **Reward Cost Manipulation**: A child attempts to update the cost of a reward to 0.
7. **Phantom Notification**: A user attempts to create a notification for another user.
8. **History Forgery**: A user attempts to create a history entry for another user.
9. **Invite Code Brute Force**: (Implicitly protected by requiring auth and lookup).
10. **Shadow Field Injection**: Adding an `isAdmin: true` field to a user profile.
11. **ID Poisoning**: Using a 1MB string as a document ID.
12. **Recursive Resource Exhaustion**: Massive string in a description field.

## Firestore Rules Test (Concept)
The rules will be tested against these scenarios to ensure `PERMISSION_DENIED`.
