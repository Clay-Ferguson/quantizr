/* tslint:disable */
/* eslint-disable */

export interface Attachment {
    ordinal: number;
    width: number;
    height: number;
    position: string;
    mime: string;
    fileName: string;
    cssSize: string;
    size: number;
    bin: string;
    binData: string;
    url: string;
    aiPrompt: string;
}

export interface Bookmark {
    name: string;
    id: string;
    selfId: string;
    search: string;
}

export interface ClientConfig {
    config: { [index: string]: any };
    brandingAppName: string;
    requireCrypto: boolean;
    useOpenAi: boolean;
    usePplxAi: boolean;
    useGeminiAi: boolean;
    useAnthAi: boolean;
    useXAi: boolean;
    userMsg: string;
    displayUserProfileId: string;
    initialNodeId: string;
    urlView: string;
    search: string;
    login: string;
    paymentLink: string;
    aiAgentEnabled: boolean;
    userGuideUrl: string;
}

export interface NodeLink {
    id: string;
    name: string;
    embed: boolean;
}

export interface OpenGraph {
    mime: string;
    url: string;
    title: string;
    description: string;
    image: string;
}

export interface RssFeed {
    encoding: string;
    title: string;
    description: string;
    author: string;
    link: string;
    image: string;
    entries: RssFeedEntry[];
}

export interface RssFeedEnclosure {
    type: string;
    url: string;
}

export interface RssFeedEntry {
    parentFeedTitle: string;
    author: string;
    title: string;
    subTitle: string;
    publishDate: string;
    image: string;
    thumbnail: string;
    description: string;
    link: string;
    enclosures: RssFeedEnclosure[];
    mediaContent: RssFeedMediaContent[];
}

export interface RssFeedMediaContent {
    type: string;
    url: string;
    medium: string;
}

export interface SchemaOrgClass {
    id: string;
    comment: string;
    label: string;
    props: SchemaOrgProp[];
}

export interface SchemaOrgProp {
    comment: string;
    label: string;
    ranges: SchemaOrgRange[];
}

export interface SchemaOrgRange {
    id: string;
}

export interface SearchDefinition {
    name: string;
    searchText: string;
    sortDir: string;
    sortField: string;
    searchProp: string;
    fuzzy: boolean;
    caseSensitive: boolean;
    recursive: boolean;
    requirePriority: boolean;
    requireAttachment: boolean;
    requireDate: boolean;
    displayLayout: string;
}

export interface SystemConfig {
    agentNodeId: string;
    systemPrompt: string;
    foldersToInclude: string;
    foldersToExclude: string;
    template: string;
    model: string;
    service: string;
    maxWords: number;
    temperature: number;
    fileExtensions: string;
}

export interface UserProfile {
    displayName: string;
    userName: string;
    homeNodeId: string;
    userBio: string;
    userTags: string;
    blockedWords: string;
    recentTypes: string;
    avatarVer: string;
    headerImageVer: string;
    userNodeId: string;
    followerCount: number;
    followingCount: number;
    following: boolean;
    blocked: boolean;
    relays: string;
    balance: number;
}

export interface AddCreditRequest extends RequestBase {
    amount: number;
    userId: string;
}

export interface AddFriendRequest extends RequestBase {
    userName: string;
    tags: string;
}

export interface AddPrivilegeRequest extends RequestBase {
    nodeId: string;
    privileges: string[];
    principals: string[];
}

export interface AskSubGraphRequest extends RequestBase {
    nodeId: string;
    question: string;
    nodeIds: string[];
}

export interface BlockUserRequest extends RequestBase {
    userName: string;
}

export interface BrowseFolderRequest extends RequestBase {
    nodeId: string;
}

export interface ChangePasswordRequest extends RequestBase {
    newPassword: string;
    passCode: string;
}

export interface CheckMessagesRequest extends RequestBase {
}

export interface CloseAccountRequest extends RequestBase {
}

export interface CopySharingRequest extends RequestBase {
    nodeId: string;
}

export interface CreateSubNodeRequest extends RequestBase {
    nodeId: string;
    pendingEdit: boolean;
    content: string;
    newNodeName: string;
    typeName: string;
    createAtTop: boolean;
    aiMode: string;
    allowAiOverwrite: boolean;
    aiRequest: boolean;
    typeLock: boolean;
    properties: PropertyInfo[];
    shareToUserId: string;
    payloadType: string;
}

export interface DeleteAttachmentRequest extends RequestBase {
    nodeId: string;
    attName: string;
}

export interface DeleteFriendRequest extends RequestBase {
    userNodeId: string;
}

export interface DeleteNodesRequest extends RequestBase {
    nodeIds: string[];
    childrenOnly: boolean;
    bulkDelete: boolean;
    jumpToParentOf: string;
    force: boolean;
}

export interface DeletePropertyRequest extends RequestBase {
    nodeId: string;
    propNames: string[];
}

export interface DeleteSearchDefRequest extends RequestBase {
    searchDefName: string;
}

export interface DeleteUserTransactionsRequest extends RequestBase {
    userId: string;
}

export interface ExportRequest extends RequestBase {
    nodeId: string;
    exportExt: string;
    fileName: string;
    includeToc: boolean;
    includeMetaComments: boolean;
    contentType: string;
    includeIDs: boolean;
    dividerLine: boolean;
    updateHeadings: boolean;
    threadAsPDF: boolean;
    includeOwners: boolean;
    numberedFigures: boolean;
    contentWidth: string;
}

export interface FileSearchRequest extends RequestBase {
    searchText: string;
    reindex: boolean;
    nodeId: string;
}

export interface FileSystemReindexRequest extends RequestBase {
    nodeId: string;
}

export interface GenerateBookByAIRequest extends RequestBase {
    nodeId: string;
    prompt: string;
    numChapters: number;
    numSections: number;
}

export interface GetBookmarksRequest extends RequestBase {
}

export interface GetFollowersRequest extends RequestBase {
    page: number;
    targetUserName: string;
}

export interface GetFollowingRequest extends RequestBase {
    page: number;
    targetUserName: string;
}

export interface GetMultiRssRequest extends RequestBase {
    urls: string;
    page: number;
}

export interface GetNodeJsonRequest extends RequestBase {
    nodeId: string;
}

export interface GetNodePrivilegesRequest extends RequestBase {
    nodeId: string;
}

export interface GetNodeStatsRequest extends RequestBase {
    nodeId: string;
    getWords: boolean;
    getTags: boolean;
}

export interface GetOpenGraphRequest extends RequestBase {
    url: string;
}

export interface GetPeopleRequest extends RequestBase {
    nodeId: string;
    type: string;
}

export interface GetRepliesViewRequest extends RequestBase {
    nodeId: string;
}

export interface GetSchemaOrgTypesRequest extends RequestBase {
}

export interface GetSearchDefsRequest extends RequestBase {
}

export interface GetServerInfoRequest extends RequestBase {
    command: string;
    parameter: string;
    nodeId: string;
}

export interface GetSharedNodesRequest extends RequestBase {
    page: number;
    nodeId: string;
    shareTarget: string;
    accessOption: string;
}

export interface GetThreadViewRequest extends RequestBase {
    nodeId: string;
    loadOthers: boolean;
}

export interface GetUserAccountInfoRequest extends RequestBase {
}

export interface GetUserProfileRequest extends RequestBase {
    userId: string;
}

export interface GraphRequest extends RequestBase {
    nodeId: string;
    searchDefinition: SearchDefinition;
}

export interface ImportJsonRequest extends RequestBase {
    nodeId: string;
    type: string;
}

export interface ImportRequest extends RequestBase {
    nodeId: string;
    sourceFileName: string;
}

export interface InitNodeEditRequest extends RequestBase {
    nodeId: string;
    editMyFriendNode: boolean;
}

export interface InsertNodeRequest extends RequestBase {
    pendingEdit: boolean;
    parentId: string;
    siblingId: string;
    targetOrdinal: number;
    newNodeName: string;
    typeName: string;
    initialValue: string;
    aiMode: string;
}

export interface JoinNodesRequest extends RequestBase {
    nodeIds: string[];
}

export interface LikeNodeRequest extends RequestBase {
    id: string;
    like: boolean;
}

export interface LinkNodesRequest extends RequestBase {
    sourceNodeId: string;
    targetNodeId: string;
    name: string;
    type: string;
    embed: boolean;
}

export interface LoginRequest extends RequestBase {
    userName: string;
    password: string;
    asymEncKey: string;
    tzOffset: number;
    dst: boolean;
}

export interface LogoutRequest extends RequestBase {
}

export interface ModifySubGraphRequest extends RequestBase {
    targetSet: string;
    nodeId: string;
    hashtags: string;
    action: string;
}

export interface MoveNodesRequest extends RequestBase {
    targetNodeId: string;
    nodeIds: string[];
    location: string;
    copyPaste: boolean;
}

export interface NodeFeedRequest extends RequestBase {
    page: number;
    toUser: string;
    toMe: boolean;
    fromMe: boolean;
    fromFriends: boolean;
    toPublic: boolean;
    searchText: string;
    friendsTagSearch: string;
    loadFriendsTags: boolean;
    applyAdminBlocks: boolean;
    name: string;
}

export interface NodeSearchRequest extends RequestBase {
    searchDefinition: SearchDefinition;
    searchRootOption: string;
    page: number;
    nodeId: string;
    view: string;
    searchType: string;
    timeRangeType: string;
    deleteMatches: boolean;
}

export interface OpenSystemFileRequest extends RequestBase {
    fileName: string;
}

export interface PasteAttachmentsRequest extends RequestBase {
    sourceNodeId: string;
    targetNodeId: string;
    keys: string[];
}

export interface PingRequest extends RequestBase {
}

export interface RePublishWebsiteRequest extends RequestBase {
    nodeId: string;
}

export interface RemovePrivilegeRequest extends RequestBase {
    nodeId: string;
    principalNodeId: string;
    privilege: string;
}

export interface RenderCalendarRequest extends RequestBase {
    nodeId: string;
}

export interface RenderDocumentRequest extends RequestBase {
    rootId: string;
    includeComments: boolean;
    searchDefinition: SearchDefinition;
}

export interface RenderNodeRequest extends RequestBase {
    nodeId: string;
    offset: number;
    siblingOffset: number;
    upLevel: boolean;
    forceRenderParent: boolean;
    jumpToRss: boolean;
    goToLastPage: boolean;
    singleNode: boolean;
}

export interface ResetPasswordRequest extends RequestBase {
    user: string;
    email: string;
}

export interface SaveNodeJsonRequest extends RequestBase {
    json: string;
}

export interface SaveNodeRequest extends RequestBase {
    node: NodeInfo;
    returnInlineChildren: boolean;
}

export interface SavePublicKeyRequest extends RequestBase {
    asymEncKey: string;
}

export interface SaveUserPreferencesRequest extends RequestBase {
    userNodeId: string;
    userPreferences: UserPreferences;
}

export interface SaveUserProfileRequest extends RequestBase {
    userName: string;
    userBio: string;
    userTags: string;
    blockedWords: string;
    recentTypes: string;
    displayName: string;
}

export interface SearchAndReplaceRequest extends RequestBase {
    recursive: boolean;
    nodeId: string;
    search: string;
    replace: string;
}

export interface SelectAllNodesRequest extends RequestBase {
    parentNodeId: string;
}

export interface SendFeedbackRequest extends RequestBase {
    message: string;
}

export interface SendLogTextRequest extends RequestBase {
    text: string;
}

export interface SendTestEmailRequest extends RequestBase {
}

export interface SetCipherKeyRequest extends RequestBase {
    nodeId: string;
    principalNodeId: string;
    cipherKey: string;
}

export interface SetExpandedRequest extends RequestBase {
    nodeId: string;
}

export interface SetNodePositionRequest extends RequestBase {
    nodeId: string;
    targetName: string;
}

export interface SetSharingOptionRequest extends RequestBase {
    nodeId: string;
    unpublished: boolean;
    website: boolean;
}

export interface SignupRequest extends RequestBase {
    userName: string;
    password: string;
    email: string;
    captcha: string;
}

export interface SplitNodeRequest extends RequestBase {
    splitType: string;
    nodeId: string;
    delimiter: string;
}

export interface SubGraphHashRequest extends RequestBase {
    recursive: boolean;
    nodeId: string;
}

export interface TransferNodeRequest extends RequestBase {
    recursive: boolean;
    nodeId: string;
    fromUser: string;
    toUser: string;
    operation: string;
}

export interface UpdateFriendNodeRequest extends RequestBase {
    nodeId: string;
    tags: string;
}

export interface UpdateHeadingsRequest extends RequestBase {
    nodeId: string;
}

export interface UploadFromUrlRequest extends RequestBase {
    storeLocally: boolean;
    nodeId: string;
    sourceUrl: string;
}

export interface RequestBase {
}

export interface AddCreditResponse extends ResponseBase {
    balance: number;
}

export interface AddFriendResponse extends ResponseBase {
}

export interface AddPrivilegeResponse extends ResponseBase {
    principalPublicKey: string;
    principalNodeId: string;
    aclEntries: AccessControlInfo[];
}

export interface AskSubGraphResponse extends ResponseBase {
    answer: string;
    gptCredit: number;
}

export interface BlockUserResponse extends ResponseBase {
}

export interface BrowseFolderResponse {
    listingJson: string;
}

export interface ChangePasswordResponse extends ResponseBase {
    user: string;
}

export interface CheckMessagesResponse extends ResponseBase {
    numNew: number;
}

export interface CloseAccountResponse extends ResponseBase {
}

export interface CopySharingResponse extends ResponseBase {
}

export interface CreateSubNodeResponse extends ResponseBase {
    newNode: NodeInfo;
    encrypt: boolean;
    gptCredit: number;
    nodeChanges: NodeChanges;
}

export interface DeleteAttachmentResponse extends ResponseBase {
}

export interface DeleteFriendResponse extends ResponseBase {
}

export interface DeleteNodesResponse extends ResponseBase {
    jumpTargetId: string;
    warning: string;
}

export interface DeletePropertyResponse extends ResponseBase {
}

export interface DeleteSearchDefResponse extends ResponseBase {
    searchDefs: SearchDefinition[];
}

export interface DeleteUserTransactionsResponse extends ResponseBase {
}

export interface ExportResponse extends ResponseBase {
    fileName: string;
}

export interface FeedPushInfo extends ServerPushInfo {
    nodeInfo: NodeInfo;
}

export interface FileSearchResponse extends ResponseBase {
    searchResultNodeId: string;
}

export interface FileSystemReindexResponse extends ResponseBase {
    report: string;
}

export interface FriendInfo {
    displayName: string;
    userName: string;
    relays: string;
    avatarVer: string;
    userNodeId: string;
    friendNodeId: string;
    tags: string;
    liked: boolean;
}

export interface GenerateBookByAIResponse extends ResponseBase {
    nodeId: string;
    gptCredit: number;
}

export interface GetBookmarksResponse extends ResponseBase {
    bookmarks: Bookmark[];
}

export interface GetFollowersResponse extends ResponseBase {
    searchResults: NodeInfo[];
}

export interface GetFollowingResponse extends ResponseBase {
    searchResults: NodeInfo[];
}

export interface GetMultiRssResponse extends ResponseBase {
    feed: RssFeed;
}

export interface GetNodeJsonResponse extends ResponseBase {
    json: string;
}

export interface GetNodePrivilegesResponse extends ResponseBase {
    aclEntries: AccessControlInfo[];
}

export interface GetNodeStatsResponse extends ResponseBase {
    stats: string;
    topWords: string[];
    topTags: HashtagInfo[];
    topVotes: string[];
}

export interface GetOpenGraphResponse extends ResponseBase {
    openGraph: OpenGraph;
}

export interface GetPeopleResponse extends ResponseBase {
    nodeOwner: FriendInfo;
    people: FriendInfo[];
    friendHashTags: string[];
}

export interface GetPublicServerInfoResponse extends ResponseBase {
    serverInfo: string;
}

export interface GetRepliesViewResponse extends ResponseBase {
    nodes: NodeInfo[];
}

export interface GetSchemaOrgTypesResponse extends ResponseBase {
    classes: SchemaOrgClass[];
}

export interface GetSearchDefsResponse extends ResponseBase {
    searchDefs: SearchDefinition[];
}

export interface GetServerInfoResponse extends ResponseBase {
    messages: InfoMessage[];
    format: string;
}

export interface GetSharedNodesResponse extends ResponseBase {
    searchResults: NodeInfo[];
}

export interface GetThreadViewResponse extends ResponseBase {
    nodes: NodeInfo[];
    topReached: boolean;
}

export interface GetUserAccountInfoResponse extends ResponseBase {
    binTotal: number;
    binQuota: number;
}

export interface GetUserProfileResponse extends ResponseBase {
    userProfile: UserProfile;
}

export interface GraphResponse extends ResponseBase {
    rootNode: GraphNode;
}

export interface HashtagInfo {
    hashtag: string;
    usedWith: string[];
}

export interface ImportJsonResponse extends ResponseBase {
    nodeId: string;
}

export interface ImportResponse extends ResponseBase {
}

export interface InfoMessage {
    message: string;
    type: string;
}

export interface InitNodeEditResponse extends ResponseBase {
    nodeInfo: NodeInfo;
}

export interface InsertNodeResponse extends ResponseBase {
    newNode: NodeInfo;
    nodeChanges: NodeChanges;
}

export interface JoinNodesResponse extends ResponseBase {
}

export interface LikeNodeResponse extends ResponseBase {
}

export interface LinkNodesResponse extends ResponseBase {
}

export interface LoginResponse extends ResponseBase {
    userProfile: UserProfile;
    authToken: string;
    rootNodePath: string;
    anonUserLandingPageNode: string;
    userPreferences: UserPreferences;
    allowFileSystemSearch: boolean;
}

export interface LogoutResponse extends ResponseBase {
}

export interface ModifySubGraphResponse extends ResponseBase {
}

export interface MoveNodesResponse extends ResponseBase {
    nodeChanges: NodeChanges;
}

export interface NodeEditedPushInfo extends ServerPushInfo {
    nodeInfo: NodeInfo;
}

export interface NodeFeedResponse extends ResponseBase {
    endReached: boolean;
    searchResults: NodeInfo[];
    friendHashTags: string[];
}

export interface NodeSearchResponse extends ResponseBase {
    searchResults: NodeInfo[];
    node: NodeInfo;
}

export interface NotificationMessage extends ServerPushInfo {
    nodeId: string;
    fromUser: string;
    message: string;
}

export interface OpenSystemFileResponse extends ResponseBase {
}

export interface PasteAttachmentsResponse extends ResponseBase {
    targetNode: NodeInfo;
}

export interface PingResponse extends ResponseBase {
    serverInfo: string;
}

export interface PushPageMessage extends ServerPushInfo {
    payload: string;
    usePopup: boolean;
    subType: string;
}

export interface RePublishWebsiteResponse extends ResponseBase {
}

export interface RemovePrivilegeResponse extends ResponseBase {
}

export interface RenderCalendarResponse extends ResponseBase {
    items: CalendarItem[];
}

export interface RenderDocumentResponse extends ResponseBase {
    searchResults: NodeInfo[];
    breadcrumbs: BreadcrumbInfo[];
}

export interface RenderNodeResponse extends ResponseBase {
    node: NodeInfo;
    endReached: boolean;
    noDataResponse: string;
    breadcrumbs: BreadcrumbInfo[];
    rssNode: boolean;
}

export interface ResetPasswordResponse extends ResponseBase {
}

export interface SaveNodeJsonResponse extends ResponseBase {
}

export interface SaveNodeResponse extends ResponseBase {
    node: NodeInfo;
    aclEntries: AccessControlInfo[];
}

export interface SavePublicKeyResponse extends ResponseBase {
}

export interface SaveUserPreferencesResponse extends ResponseBase {
}

export interface SaveUserProfileResponse extends ResponseBase {
}

export interface SearchAndReplaceResponse extends ResponseBase {
}

export interface SelectAllNodesResponse extends ResponseBase {
    nodeIds: string[];
}

export interface SendFeedbackResponse extends ResponseBase {
}

export interface SendLogTextResponse extends ResponseBase {
}

export interface SendTestEmailResponse extends ResponseBase {
}

export interface ServerPushInfo {
    type: string;
}

export interface SetCipherKeyResponse extends ResponseBase {
}

export interface SetExpandedResponse extends ResponseBase {
    node: NodeInfo;
}

export interface SetNodePositionResponse extends ResponseBase {
    nodeChanges: NodeChanges;
}

export interface SetSharingOptionResponse extends ResponseBase {
}

export interface SignupResponse extends ResponseBase {
    userError: string;
    passwordError: string;
    emailError: string;
    captchaError: string;
}

export interface SplitNodeResponse extends ResponseBase {
    nodeChanges: NodeChanges;
}

export interface SubGraphHashResponse extends ResponseBase {
}

export interface TransferNodeResponse extends ResponseBase {
}

export interface UpdateAccountInfo extends ServerPushInfo {
    nodeId: string;
    credit: number;
}

export interface UpdateFriendNodeResponse extends ResponseBase {
}

export interface UpdateHeadingsResponse extends ResponseBase {
}

export interface UploadFromUrlResponse extends ResponseBase {
}

export interface UploadResponse extends ResponseBase {
    payloads: string[];
}

export interface NodeChanges {
    parentNodeId: string;
    ordinalShifMin: number;
    ordinalShiftRange: number;
}

export interface ResponseBase {
    message: string;
    stackTrace: string;
    code: number;
    msgCode: string;
    replica: string;
}

export interface PropertyInfo {
    name: string;
    value: any;
}

export interface NodeInfo {
    id: string;
    path: string;
    name: string;
    content: string;
    renderContent: string;
    tags: string;
    lastModified: number;
    timeAgo: string;
    logicalOrdinal: number;
    ordinal: number;
    type: string;
    properties: PropertyInfo[];
    attachments: { [index: string]: Attachment };
    links: NodeLink[];
    clientProps: PropertyInfo[];
    ac: AccessControlInfo[];
    hasChildren: boolean;
    cipherKey: string;
    lastChild: boolean;
    children: NodeInfo[];
    linkedNodes: NodeInfo[];
    likes: string[];
    imgId: string;
    displayName: string;
    owner: string;
    ownerId: string;
    transferFromId: string;
    avatarVer: string;
    apAvatar: string;
    apImage: string;
}

export interface UserPreferences {
    editMode: boolean;
    aiMode: string;
    showMetaData: boolean;
    showProps: boolean;
    autoRefreshFeed: boolean;
    showReplies: boolean;
    rssHeadlinesOnly: boolean;
    mainPanelCols: number;
    maxUploadFileSize: number;
}

export interface AccessControlInfo {
    displayName: string;
    principalName: string;
    principalNodeId: string;
    avatarVer: string;
    privileges: PrivilegeInfo[];
    publicKey: string;
}

export interface GraphNode {
    id: string;
    level: number;
    highlight: boolean;
    name: string;
    children: GraphNode[];
    links: NodeLink[];
}

export interface CalendarItem {
    id: string;
    title: string;
    start: number;
    end: number;
}

export interface BreadcrumbInfo {
    id: string;
    name: string;
    type: string;
}

export interface PrivilegeInfo {
    privilegeName: string;
}

export const enum AIModel {
    NONE = "[null]",
    OPENAI = "openAi",
    OPENAI_MINI = "openAiMini",
    OPENAI_O1_PREVIEW = "openAi_o1Preview",
    OPENAI_O1_MINI = "openAi_o1Mini",
    PPLX_CHAT = "pplxAi",
    PPLX_ONLINE = "pplxAi_online",
    PPLX_LLAMA3 = "llama3",
    ANTH = "anthAi",
    ANTH_SONNET = "anthAi_sonnet",
    GEMINI = "geminiAi",
    GEMINI_FLASH = "geminiFlashAi",
    XAI = "XAi",
}

export const enum Constant {
    SEARCH_TYPE_USERS = "userAll",
    SEARCH_TYPE_LINKED_NODES = "linkedNodes",
    SEARCH_TYPE_RDF_SUBJECTS = "rdfSubjects",
    ENC_TAG = "<[ENC]>",
    FEED_NEW = "myNewMessages",
    FEED_PUB = "publicPosts",
    FEED_TOFROMME = "toFromMe",
    FEED_TOME = "toMe",
    FEED_FROMMETOUSER = "fromMeToUser",
    FEED_FROMME = "fromMe",
    FEED_FROMFRIENDS = "fromFriends",
    FEED_LOCAL = "local",
    FEED_NODEFEED = "nodeFeed",
    ATTACHMENT_PRIMARY = "p",
    ATTACHMENT_HEADER = "h",
    AI_MODE_CHAT = "chat",
    AI_MODE_AGENT = "agent",
    AI_MODE_WRITING = "writing",
    SIG_TBD = "tbd",
}

export const enum ConstantInt {
    ROWS_PER_PAGE = 50,
    DOC_ITEMS_PER_PAGE = 100,
    MAX_EXPANDED_CHILDREN = 100,
}

export const enum NodeProp {
    ENC_KEY = "sn:encKey",
    SUBGRAPH_HASH = "sn:rSHA256",
    RSS_FEED_SRC = "sn:rssFeedSrc",
    AUDIO_URL = "sn:audioUrl",
    USER_PREF_PUBLIC_KEY = "sn:publicKey",
    USER_PREF_EDIT_MODE = "sn:editMode",
    USER_PREF_AI_MODE = "sn:aiMode",
    USER_PREF_SHOW_METADATA = "sn:showMetaData",
    USER_PREF_SHOW_PROPS = "sn:showProps",
    USER_PREF_AUTO_REFRESH_FEED = "sn:autoRefreshFeed",
    USER_PREF_SHOW_REPLIES = "sn:showReplies",
    USER_PREF_PASSWORD_RESET_AUTHCODE = "sn:pwdResetAuth",
    USER_PREF_RSS_HEADINGS_ONLY = "sn:rssHeadingsOnly",
    USER_PREF_MAIN_PANEL_COLS = "sn:mainPanelCols",
    SIGNUP_PENDING = "sn:signupPending",
    EMAIL_CONTENT = "sn:content",
    EMAIL_RECIP = "sn:recip",
    EMAIL_SUBJECT = "sn:subject",
    TARGET_ID = "sn:target_id",
    BOOKMARK_SEARCH_TEXT = "search",
    USER = "sn:user",
    DISPLAY_NAME = "sn:displayName",
    USER_BIO = "sn:userBio",
    USER_TAGS = "sn:tags",
    USER_SEACH_DEFINITIONS = "sn:searchDefs",
    USER_BLOCK_WORDS = "sn:blockWords",
    USER_RECENT_TYPES = "sn:recentTypes",
    USER_AI_BALANCE = "sn:aiBalance",
    PWD_HASH = "sn:pwdHash",
    VOTE = "vote",
    FILE_SYNC_LINK = "fs:link",
    USER_NODE_ID = "sn:userNodeId",
    NAME = "sn:name",
    FS_LINK = "fs:link",
    MIME_EXT = "sn:ext",
    EMAIL = "sn:email",
    CODE = "sn:code",
    JSON_FILE_SEARCH_RESULT = "sn:json",
    NOWRAP = "sn:nowrap",
    BIN = "bin",
    BIN_WEBSITE = "bin-website",
    BIN_TOTAL = "sn:binTot",
    BIN_QUOTA = "sn:binQuota",
    LAST_LOGIN_TIME = "sn:lastLogin",
    LAST_ACTIVE_TIME = "sn:lastActive",
    INLINE_CHILDREN = "inlineChildren",
    EXPANSION_BY_USER = "expansionByUser",
    PRIORITY = "priority",
    PRIORITY_FULL = "p.priority",
    LAYOUT = "layout",
    ORDER_BY = "orderBy",
    NO_EXPORT = "noexport",
    TYPE_LOCK = "sn:typLoc",
    DATE = "date",
    DATE_FULL = "p.date",
    UNPUBLISHED = "unpub",
    WEBSITE = "website",
    AI_PROMPT = "ai",
    AI_FOLDERS_TO_INCLUDE = "aiFolders",
    AI_FOLDERS_TO_EXCLUDE = "aiFoldersExclude",
    AI_FILE_EXTENSIONS = "aiFileExt",
    AI_SERVICE = "aiService",
    AI_CONFIG = "aiConfig",
    AI_QUERY_TEMPLATE = "aiTemplate",
    AI_MAX_WORDS = "aiMaxWords",
    AI_TEMPERATURE = "aiTemp",
    DURATION = "duration",
    IN_PENDING_PATH = "pendingPath",
    OPEN_GRAPH = "sn:og",
    TRUNCATED = "trunc",
}

export const enum NodeType {
    ACCOUNT = "sn:account",
    REPO_ROOT = "sn:repoRoot",
    INBOX = "sn:inbox",
    INBOX_ENTRY = "sn:inboxEntry",
    ROOM = "sn:room",
    NOTES = "sn:notes",
    BOOKMARK = "sn:bookmark",
    BOOKMARK_LIST = "sn:bookmarkList",
    EXPORTS = "sn:exports",
    CALCULATOR = "sn:calculator",
    COMMENT = "sn:comment",
    AI_QUERY = "sn:aiQuery",
    AI_ANSWER = "sn:aiAns",
    AI_AGENT = "sn:aiAgent",
    RSS_FEED = "sn:rssfeed",
    FRIEND_LIST = "sn:friendList",
    BLOCKED_USERS = "sn:blockedUsers",
    FRIEND = "sn:friend",
    POSTS = "sn:posts",
    NONE = "u",
    PLAIN_TEXT = "sn:txt",
    FS_FILE = "fs:file",
    FS_FOLDER = "fs:folder",
}

export const enum PrincipalName {
    ANON = "anonymous",
    ADMIN = "admin",
    PUBLIC = "public",
}

export const enum PrivilegeType {
    READ = "rd",
    WRITE = "wr",
}

export const enum TransferOp {
    TRANSFER = "transfer",
    ACCEPT = "accept",
    REJECT = "reject",
    RECLAIM = "reclaim",
}
