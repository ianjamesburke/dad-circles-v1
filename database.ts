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
    startSession,
    redeemMagicLink,
    generateWeekendMission,
    createWeekendMissionJob,
    getWeekendMissionJob,
} from '@/services/callableService';
import {
    getProfile,
    createProfile,
    updateProfile,
    getAllProfiles,
    getUsersInGroup,
    updateUserGroupAssignment,
    deleteUserData,
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
    deleteLeadsForUser,
} from '@/services/leadService';
import {
    createGroup,
    getGroup,
    getAllGroups,
    getGroupsByLocation,
    updateGroup,
} from '@/services/groupService';
import {
    getAllBlogPosts,
    getBlogPostBySlug,
    createBlogPost,
} from '@/services/blogService';
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
    deleteLeadsForUser,

    // Groups
    createGroup,
    getGroup,
    getAllGroups,
    getGroupsByLocation,
    updateGroup,

    // Blog Posts
    getAllBlogPosts,
    getBlogPostBySlug,
    createBlogPost,

    // Matching
    getUnmatchedUsers,
    getUsersInGroup,
    updateUserGroupAssignment,
    deleteUserData,
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
    startSession,
    redeemMagicLink,
    generateWeekendMission,
    createWeekendMissionJob,
    getWeekendMissionJob,
};

export { getLifeStageFromUser };
