
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export const startSession = async (
  email: string,
  postcode: string,
  signupForOther: boolean
): Promise<any> => {
    try {
      console.info('startSession callable: invoking');
      const startSessionFn = httpsCallable(functions, 'startSession');
      const result = await startSessionFn({ email, postcode, signupForOther });
      console.info('startSession callable: success', { status: (result?.data as any)?.status });
      return result.data;
    } catch (error) {
      console.error('❌ Error starting session:', error);
      throw error;
    }
};

export const redeemMagicLink = async (token: string): Promise<any> => {
    try {
      const redeemFn = httpsCallable(functions, 'redeemMagicLink');
      const result = await redeemFn({ token });
      return result.data;
    } catch (error) {
      console.error('❌ Error redeeming magic link:', error);
      throw error;
    }
};

export const runMatchingAlgorithm = async (): Promise<any> => {
    try {
      const runMatchingFn = httpsCallable(functions, 'runMatching');
      // No longer passing testMode per V1 spec
      const result = await runMatchingFn({});
      return result.data;
    } catch (error) {
      console.error('❌ Error running matching algorithm:', error);
      throw error;
    }
};

export const approveGroup = async (groupId: string): Promise<any> => {
    try {
      const approveGroupFn = httpsCallable(functions, 'approveGroup');
      const result = await approveGroupFn({ groupId });
      return result.data;
    } catch (error) {
      console.error('❌ Error approving group:', error);
      throw error;
    }
};

export const deleteGroupFunc = async (groupId: string): Promise<any> => {
    try {
      const deleteGroupFn = httpsCallable(functions, 'deleteGroup');
      const result = await deleteGroupFn({ groupId });
      return result.data;
    } catch (error) {
      console.error('❌ Error deleting group:', error);
      throw error;
    }
};

export const sendMagicLink = async (email: string): Promise<any> => {
    try {
      const sendMagicLinkFn = httpsCallable(functions, 'sendMagicLink');
      const result = await sendMagicLinkFn({ email });
      return result.data;
    } catch (error) {
      console.error('❌ Error sending magic link:', error);
      // Don't rethrow to avoid leaking info to client or breaking flow
      // But caller might want to know? The plan catches it.
      return { success: false, error };
    }
};

export const sendCompletionEmail = async (email: string, sessionId: string): Promise<any> => {
    try {
      const sendCompletionEmailFn = httpsCallable(functions, 'sendCompletionEmail');
      const result = await sendCompletionEmailFn({ email, sessionId });
      return result.data;
    } catch (error) {
      console.error('❌ Error sending completion email:', error);
      return { success: false, error };
    }
};

export const sendManualAbandonmentEmail = async (sessionId: string): Promise<any> => {
    try {
      const sendEmailFn = httpsCallable(functions, 'sendManualAbandonmentEmail');
      const result = await sendEmailFn({ sessionId });
      return result.data;
    } catch (error) {
      console.error('❌ Error sending manual abandonment email:', error);
      return { success: false, error };
    }
};
