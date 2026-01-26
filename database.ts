
import {
    getUnmatchedUsers,
    getMatchingStats,
} from '@/services/matchingService';
import {
    runMatchingAlgorithm,
    approveGroup,
    deleteGroupFunc,
    sendMagicLink,
    sendCompletionEmail,
    sendManualAbandonmentEmail,
} from '@/services/callableService';
import {
    getProfile,
    createProfile,
    updateProfile,
    getAllProfiles,
    getUsersInGroup,
    updateUserGroupAssignment,
} from '@/services/userService';
import {
    addMessage,
    getMessages,
    getAllMessages,
} from '@/services/messageService';
import {
    addLead,
    getAllLeads,
    getLeadByEmail,
    updateLead,
} from '@/services/leadService';
import {
    createGroup,
    getGroup,
    getAllGroups,
    getGroupsByLocation,
    updateGroup,
} from '@/services/groupService';
import {
    seedTestData,
    resetDatabase,
    cleanTestData,
} from '@/services/devService';
import { getLifeStageFromUser } from '@/utils/user';

export const database = {
    // Profiles
    getProfile,
    createProfile,
    updateProfile,
    getAllProfiles,

    // Messages
    addMessage,
    getMessages,
    getAllMessages,

    // Leads
    addLead,
    getAllLeads,
    getLeadByEmail,
    updateLead,

    // Groups
    createGroup,
    getGroup,
    getAllGroups,
    getGroupsByLocation,
    updateGroup,

    // Matching
    getUnmatchedUsers,
    getUsersInGroup,
    updateUserGroupAssignment,
    getMatchingStats,

    // Database management (dev/emulator only)
    seedTestData,
    resetDatabase,
    cleanTestData,

    // Functions
    runMatchingAlgorithm,
    approveGroup,
    deleteGroup: deleteGroupFunc,
    sendMagicLink,
    sendCompletionEmail,
    sendManualAbandonmentEmail,
};

export { getLifeStageFromUser };
