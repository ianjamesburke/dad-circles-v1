import { db } from '../firebase';
import {
  collection,
  getDocs,
  query,
  where,
  getCountFromServer,
} from 'firebase/firestore';
import { UserProfile, MatchingStats } from '../types';

const profilesCol = collection(db, 'profiles');

export const getUnmatchedUsers = async (city?: string, stateCode?: string): Promise<UserProfile[]> => {
  let q = query(profilesCol, where('matching_eligible', '==', true), where('group_id', '==', null));

  if (city && stateCode) {
    q = query(
      profilesCol,
      where('matching_eligible', '==', true),
      where('group_id', '==', null),
      where('location.city', '==', city),
      where('location.state_code', '==', stateCode)
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as UserProfile);
};

export const getMatchingStats = async (): Promise<MatchingStats> => {
  const totalSnap = await getCountFromServer(profilesCol);

  const eligibleQuery = query(profilesCol, where('matching_eligible', '==', true));
  const eligibleSnap = await getCountFromServer(eligibleQuery);

  const matchedQuery = query(profilesCol, where('group_id', '!=', null));
  const matchedSnap = await getCountFromServer(matchedQuery);

  const eligible = eligibleSnap.data().count;
  const matched = matchedSnap.data().count;

  return {
    total_users: totalSnap.data().count,
    matched_users: matched,
    unmatched_users: eligible - matched,
  };
};
