
import { httpsCallable, HttpsCallableResult } from 'firebase/functions';
import { functions, auth } from '../firebase';
import {
  WeekendMissionRequest,
  WeekendMissionResponse,
  WeekendMissionJobResponse,
  WeekendMissionJobStatus
} from '../types';

// Helper to handle auth errors consistently
const handleCallableError = (error: any, functionName: string) => {
  console.error(`❌ Error in ${functionName}:`, error);

  // Check for permission-denied errors (expired token)
  if (error.code === 'functions/permission-denied') {
    console.warn('⚠️ Permission denied - token may be expired. Try logging out and back in.');
  }

  throw error;
};

export const startSession = async (
  email: string,
  postcode: string,
  signupForOther: boolean,
  utm?: Record<string, string>
): Promise<any> => {
  try {
    console.info('startSession callable: invoking');
    const startSessionFn = httpsCallable(functions, 'startSession');
    const result = await startSessionFn({ email, postcode, signupForOther, utm });
    console.info('startSession callable: success', { status: (result?.data as any)?.status });
    return result.data;
  } catch (error) {
    handleCallableError(error, 'startSession');
  }
};

export const redeemMagicLink = async (token: string): Promise<any> => {
  try {
    const redeemFn = httpsCallable(functions, 'redeemMagicLink');
    const result = await redeemFn({ token });
    return result.data;
  } catch (error) {
    handleCallableError(error, 'redeemMagicLink');
  }
};

export const runMatchingAlgorithm = async (): Promise<any> => {
  try {
    const runMatchingFn = httpsCallable(functions, 'runMatching');
    // No longer passing testMode per V1 spec
    const result = await runMatchingFn({});
    return result.data;
  } catch (error) {
    handleCallableError(error, 'runMatchingAlgorithm');
  }
};

export const approveGroup = async (groupId: string): Promise<any> => {
  try {
    const approveGroupFn = httpsCallable(functions, 'approveGroup');
    const result = await approveGroupFn({ groupId });
    return result.data;
  } catch (error) {
    handleCallableError(error, 'approveGroup');
  }
};

export const deleteGroupFunc = async (groupId: string): Promise<any> => {
  try {
    const deleteGroupFn = httpsCallable(functions, 'deleteGroup');
    const result = await deleteGroupFn({ groupId });
    return result.data;
  } catch (error) {
    handleCallableError(error, 'deleteGroup');
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

export const generateWeekendMission = async (
  payload: WeekendMissionRequest
): Promise<WeekendMissionResponse> => {
  try {
    const generateMissionFn = httpsCallable(functions, 'generateWeekendMission', { timeout: 300000 });
    const result = await generateMissionFn(payload);
    return result.data as WeekendMissionResponse;
  } catch (error) {
    handleCallableError(error, 'generateWeekendMission');
    throw error;
  }
};

export const createWeekendMissionJob = async (
  payload: WeekendMissionRequest
): Promise<WeekendMissionJobResponse> => {
  try {
    const createJobFn = httpsCallable(functions, 'createWeekendMissionJob');
    const result = await createJobFn(payload);
    return result.data as WeekendMissionJobResponse;
  } catch (error) {
    handleCallableError(error, 'createWeekendMissionJob');
    throw error;
  }
};

export const getWeekendMissionJob = async (jobId: string): Promise<WeekendMissionJobStatus> => {
  try {
    const getJobFn = httpsCallable(functions, 'getWeekendMissionJob');
    const result = await getJobFn({ job_id: jobId });
    return result.data as WeekendMissionJobStatus;
  } catch (error) {
    handleCallableError(error, 'getWeekendMissionJob');
    throw error;
  }
};
