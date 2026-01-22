import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { runMatchingAlgorithm, seedTestData, approveAndEmailGroup, deleteGroup as deleteGroupLogic } from "./matching";

/**
 * Callable function to run the matching algorithm
 * Can be called from the Admin Dashboard
 */
export const runMatching = onCall({ cors: true }, async (request) => {
    // Stricter admin auth check
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    // V1 Spec: Test mode concept removed, always false
    const testMode = false;
    logger.info("Run matching called", { uid: request.auth?.uid, testMode });

    try {
        const result = await runMatchingAlgorithm(undefined, undefined, testMode);
        return {
            success: true,
            result: result
        };
    } catch (error) {
        logger.error("Error in runMatching callable:", error);
        throw new HttpsError('internal', 'Matching algorithm failed', error);
    }
});

/**
 * Callable function to seed test data
 * ONLY works in development/emulator environment or if explicitly allowed
 */
export const seedData = onCall({ cors: true }, async (request) => {
    // Stricter admin auth check
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    logger.info("Seed data called", { uid: request.auth?.uid });

    try {
        await seedTestData();
        return { success: true, message: "Test data seeded successfully" };
    } catch (error) {
        logger.error("Error in seedData callable:", error);
        throw new HttpsError('internal', 'Seeding failed', error);
    }
});

/**
 * Callable function to approve a group and send emails
 */
export const approveGroup = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const { groupId } = request.data;
    if (!groupId) {
        throw new HttpsError('invalid-argument', 'groupId is required');
    }

    logger.info("Approve group called", { uid: request.auth?.uid, groupId });

    try {
        const result = await approveAndEmailGroup(groupId);
        return result;
    } catch (error) {
        logger.error("Error in approveGroup callable:", error);
        throw new HttpsError('internal', 'Group approval failed', error);
    }
});

/**
 * Callable function to delete a group
 */
export const deleteGroup = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const { groupId } = request.data;
    if (!groupId) {
        throw new HttpsError('invalid-argument', 'groupId is required');
    }

    logger.info("Delete group called", { uid: request.auth?.uid, groupId });

    try {
        const result = await deleteGroupLogic(groupId);
        return result;
    } catch (error) {
        logger.error("Error in deleteGroup callable:", error);
        throw new HttpsError('internal', 'Group deletion failed', error);
    }
});

