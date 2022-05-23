/* tslint:disable */
/* eslint-disable */

export interface Bookmark {
    name: string;
    id: string;
    selfId: string;
}

export interface IPSMData {
    mime: string;
    data: string;
}

export interface IPSMMessage {
    from: string;
    sig: string;
    content: IPSMData[];
    ts: number;
}

export interface MFSDirEntry {
    file: boolean;
    dir: boolean;
    Name: string;
    Type: number;
    Size: number;
    Hash: string;
}

export interface NodeMetaIntf {
    id: string;
    hasChildren: boolean;
}

export interface OpenGraph {
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

export interface UserProfile {
    displayName: string;
    userName: string;
    homeNodeId: string;
    didIPNS: string;
    mfsEnable: boolean;
    userBio: string;
    userTags: string;
    avatarVer: string;
    headerImageVer: string;
    userNodeId: string;
    apIconUrl: string;
    apImageUrl: string;
    actorUrl: string;
    followerCount: number;
    followingCount: number;
    following: boolean;
    blocked: boolean;
}

export interface AddFriendRequest extends RequestBase {
    userName: string;
}

export interface AddPrivilegeRequest extends RequestBase {
    nodeId: string;
    privileges: string[];
    principal: string;
}

export interface AppDropRequest extends RequestBase {
    data: string;
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
    typeLock: boolean;
    properties: PropertyInfo[];
    shareToUserId: string;
    payloadType?: string;
}

export interface DeleteAttachmentRequest extends RequestBase {
    nodeId: string;
}

export interface DeleteFriendRequest extends RequestBase {
    userNodeId: string;
}

export interface DeleteMFSFileRequest extends RequestBase {
    item: string;
}

export interface DeleteNodesRequest extends RequestBase {
    nodeIds: string[];
    childrenOnly: boolean;
}

export interface DeletePropertyRequest extends RequestBase {
    nodeId: string;
    propNames: string[];
}

export interface ExportRequest extends RequestBase {
    nodeId: string;
    exportExt: string;
    fileName: string;
    toIpfs: boolean;
}

export interface FileSearchRequest extends RequestBase {
    searchText: string;
    reindex: boolean;
    nodeId: string;
}

export interface FileSystemReindexRequest extends RequestBase {
    nodeId: string;
}

export interface GetActPubObjectRequest extends RequestBase {
    url: string;
}

export interface GetBookmarksRequest extends RequestBase {
}

export interface GetConfigRequest extends RequestBase {
}

export interface GetFollowersRequest extends RequestBase {
    page: number;
    targetUserName: string;
}

export interface GetFollowingRequest extends RequestBase {
    page: number;
    targetUserName: string;
}

export interface GetFriendsRequest extends RequestBase {
}

export interface GetIPFSContentRequest extends RequestBase {
    id: string;
}

export interface GetIPFSFilesRequest extends RequestBase {
    folder: string;
}

export interface GetMultiRssRequest extends RequestBase {
    urls: string;
    page: number;
}

export interface GetNodeMetaInfoRequest extends RequestBase {
    ids: string[];
}

export interface GetNodePrivilegesRequest extends RequestBase {
    nodeId: string;
    includeAcl: boolean;
    includeOwners: boolean;
}

export interface GetNodeStatsRequest extends RequestBase {
    nodeId: string;
    trending: boolean;
    feed: boolean;
}

export interface GetOpenGraphRequest extends RequestBase {
    url: string;
}

export interface GetServerInfoRequest extends RequestBase {
    command: string;
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
    searchText: string;
}

export interface ImportRequest extends RequestBase {
    nodeId: string;
    sourceFileName: string;
}

export interface InitNodeEditRequest extends RequestBase {
    nodeId: string;
}

export interface InsertBookRequest extends RequestBase {
    nodeId: string;
    bookName: string;
    truncated: boolean;
}

export interface InsertNodeRequest extends RequestBase {
    pendingEdit: boolean;
    parentId: string;
    targetOrdinal: number;
    newNodeName: string;
    typeName: string;
    initialValue: string;
}

export interface JoinNodesRequest extends RequestBase {
    nodeIds: string[];
}

export interface LikeNodeRequest extends RequestBase {
    id: string;
    like: boolean;
}

export interface LoadNodeFromIpfsRequest extends RequestBase {
    path: string;
}

export interface LoginRequest extends RequestBase {
    userName: string;
    password: string;
    tzOffset?: number;
    dst?: boolean;
}

export interface LogoutRequest extends RequestBase {
}

export interface LuceneIndexRequest extends RequestBase {
    nodeId: string;
    path: string;
}

export interface LuceneSearchRequest extends RequestBase {
    nodeId: string;
    text: string;
}

export interface MoveNodesRequest extends RequestBase {
    targetNodeId: string;
    nodeIds: string[];
    location: string;
}

export interface NodeFeedRequest extends RequestBase {
    page: number;
    nodeId: string;
    toUser: string;
    toMe: boolean;
    fromMe: boolean;
    fromFriends: boolean;
    toPublic: boolean;
    localOnly: boolean;
    nsfw: boolean;
    searchText: string;
    applyAdminBlocks: boolean;
}

export interface NodeSearchRequest extends RequestBase {
    page: number;
    sortDir: string;
    sortField: string;
    nodeId: string;
    searchText: string;
    searchProp: string;
    fuzzy: boolean;
    caseSensitive: boolean;
    searchDefinition: string;
    searchType: string;
    timeRangeType: string;
    recursive: boolean;
    requirePriority: boolean;
}

export interface OpenSystemFileRequest extends RequestBase {
    fileName: string;
}

export interface PingRequest extends RequestBase {
}

export interface PublishNodeToIpfsRequest extends RequestBase {
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

export interface RenderNodeRequest extends RequestBase {
    nodeId: string;
    offset: number;
    siblingOffset: number;
    upLevel: boolean;
    renderParentIfLeaf: boolean;
    forceRenderParent: boolean;
    parentCount: number;
    goToLastPage: boolean;
    singleNode: boolean;
    forceIPFSRefresh: boolean;
}

export interface ResetPasswordRequest extends RequestBase {
    user: string;
    email: string;
}

export interface SaveNodeRequest extends RequestBase {
    node: NodeInfo;
}

export interface SavePublicKeyRequest extends RequestBase {
    keyJson: string;
}

export interface SaveUserPreferencesRequest extends RequestBase {
    userNodeId: string;
    userPreferences: UserPreferences;
}

export interface SaveUserProfileRequest extends RequestBase {
    userName: string;
    userBio: string;
    userTags: string;
    displayName: string;
    publish: boolean;
    mfsEnable: boolean;
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

export interface SetNodePositionRequest extends RequestBase {
    nodeId: string;
    targetName: string;
}

export interface SetUnpublishedRequest extends RequestBase {
    nodeId: string;
    unpublished: boolean;
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

export interface TransferNodeRequest extends RequestBase {
    recursive: boolean;
    nodeId: string;
    fromUser: string;
    toUser: string;
}

export interface UpdateHeadingsRequest extends RequestBase {
    nodeId: string;
}

export interface UploadFromIPFSRequest extends RequestBase {
    pinLocally: boolean;
    nodeId: string;
    cid: string;
    mime: string;
}

export interface UploadFromUrlRequest extends RequestBase {
    storeLocally: boolean;
    nodeId: string;
    sourceUrl: string;
}

export interface RequestBase {
}

export interface AddFriendResponse extends ResponseBase {
}

export interface AddPrivilegeResponse extends ResponseBase {
    principalPublicKey: string;
    principalNodeId: string;
}

export interface AppDropResponse extends ResponseBase {
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
}

export interface DeleteAttachmentResponse extends ResponseBase {
}

export interface DeleteFriendResponse extends ResponseBase {
}

export interface DeleteMFSFileResponse extends ResponseBase {
}

export interface DeleteNodesResponse extends ResponseBase {
}

export interface DeletePropertyResponse extends ResponseBase {
}

export interface ExportResponse extends ResponseBase {
    ipfsCid: string;
    ipfsMime: string;
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
    avatarVer: string;
    userNodeId: string;
    foreignAvatarUrl: string;
}

export interface GetActPubObjectResponse extends ResponseBase {
    nodeId: string;
}

export interface GetBookmarksResponse extends ResponseBase {
    bookmarks: Bookmark[];
}

export interface GetConfigResponse extends ResponseBase {
    config: { [index: string]: any };
}

export interface GetFollowersResponse extends ResponseBase {
    searchResults: NodeInfo[];
}

export interface GetFollowingResponse extends ResponseBase {
    searchResults: NodeInfo[];
}

export interface GetFriendsResponse extends ResponseBase {
    friends: FriendInfo[];
}

export interface GetIPFSContentResponse extends ResponseBase {
    content: string;
}

export interface GetIPFSFilesResponse extends ResponseBase {
    files: MFSDirEntry[];
    folder: string;
    cid: string;
}

export interface GetMultiRssResponse extends ResponseBase {
    feed: RssFeed;
}

export interface GetNodeMetaInfoResponse extends ResponseBase {
    nodeIntf: NodeMetaIntf[];
}

export interface GetNodePrivilegesResponse extends ResponseBase {
    aclEntries: AccessControlInfo[];
    owners: string[];
    unpublished: boolean;
}

export interface GetNodeStatsResponse extends ResponseBase {
    stats: string;
    topWords: string[];
    topTags: string[];
    topMentions: string[];
}

export interface GetOpenGraphResponse extends ResponseBase {
    openGraph: OpenGraph;
}

export interface GetPublicServerInfoResponse extends ResponseBase {
    serverInfo: string;
}

export interface GetServerInfoResponse extends ResponseBase {
    messages: InfoMessage[];
}

export interface GetSharedNodesResponse extends ResponseBase {
    searchResults: NodeInfo[];
}

export interface GetThreadViewResponse extends ResponseBase {
    nodes: NodeInfo[];
    others: NodeInfo[];
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

export interface IPSMPushInfo extends ServerPushInfo {
    payload: string;
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

export interface InsertBookResponse extends ResponseBase {
    newNode: NodeInfo;
}

export interface InsertNodeResponse extends ResponseBase {
    newNode: NodeInfo;
}

export interface JoinNodesResponse extends ResponseBase {
}

export interface LikeNodeResponse extends ResponseBase {
}

export interface LoadNodeFromIpfsResponse extends ResponseBase {
}

export interface LoginResponse extends ResponseBase {
    rootNode: string;
    authToken: string;
    rootNodePath: string;
    userName: string;
    displayName: string;
    allowedFeatures: string;
    anonUserLandingPageNode: string;
    homeNodeOverride: string;
    userPreferences: UserPreferences;
    allowFileSystemSearch: boolean;
}

export interface LogoutResponse extends ResponseBase {
}

export interface LuceneIndexResponse extends ResponseBase {
}

export interface LuceneSearchResponse extends ResponseBase {
}

export interface MoveNodesResponse extends ResponseBase {
}

export interface NodeEditedPushInfo extends ServerPushInfo {
    nodeInfo: NodeInfo;
}

export interface NodeFeedResponse extends ResponseBase {
    endReached: boolean;
    searchResults: NodeInfo[];
}

export interface NodeSearchResponse extends ResponseBase {
    searchResults: NodeInfo[];
}

export interface NotificationMessage extends ServerPushInfo {
    nodeId: string;
    fromUser: string;
    message: string;
}

export interface OpenSystemFileResponse extends ResponseBase {
}

export interface PingResponse extends ResponseBase {
    serverInfo: string;
}

export interface PublishNodeToIpfsResponse extends ResponseBase {
}

export interface PushPageMessage extends ServerPushInfo {
    payload: string;
}

export interface RemovePrivilegeResponse extends ResponseBase {
}

export interface RenderCalendarResponse extends ResponseBase {
    items: CalendarItem[];
}

export interface RenderNodeResponse extends ResponseBase {
    node: NodeInfo;
    endReached: boolean;
    noDataResponse: string;
    breadcrumbs: BreadcrumbInfo[];
}

export interface ResetPasswordResponse extends ResponseBase {
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

export interface SendLogTextResponse extends ResponseBase {
}

export interface SendTestEmailResponse extends ResponseBase {
}

export interface ServerPushInfo {
    type: string;
}

export interface SessionTimeoutPushInfo extends ServerPushInfo {
}

export interface SetCipherKeyResponse extends ResponseBase {
}

export interface SetNodePositionResponse extends ResponseBase {
}

export interface SetUnpublishedResponse extends ResponseBase {
}

export interface SignupResponse extends ResponseBase {
    userError: string;
    passwordError: string;
    emailError: string;
    captchaError: string;
}

export interface SplitNodeResponse extends ResponseBase {
}

export interface TransferNodeResponse extends ResponseBase {
}

export interface UpdateHeadingsResponse extends ResponseBase {
}

export interface UploadFromIPFSResponse extends ResponseBase {
}

export interface UploadFromUrlResponse extends ResponseBase {
}

export interface ResponseBase {
    success: boolean;
    message: string;
    stackTrace: string;
    errorType: string;
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
    tags: string;
    lastModified: Date;
    logicalOrdinal: number;
    ordinal: number;
    type: string;
    properties: PropertyInfo[];
    clientProps: PropertyInfo[];
    ac: AccessControlInfo[];
    hasChildren: boolean;
    cipherKey: string;
    lastChild: boolean;
    width: number;
    height: number;
    parent: NodeInfo;
    children: NodeInfo[];
    parents: NodeInfo[];
    likes: string[];
    imgId: string;
    displayName: string;
    owner: string;
    ownerId: string;
    dataUrl: string;
    avatarVer: string;
    apAvatar: string;
    apImage: string;
}

export interface UserPreferences {
    editMode: boolean;
    showMetaData: boolean;
    nsfw: boolean;
    showParents: boolean;
    rssHeadlinesOnly: boolean;
    mainPanelCols: number;
    enableIPSM: boolean;
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

export const enum Constant {
    SEARCH_TYPE_USER_LOCAL = "userLocal",
    SEARCH_TYPE_USER_ALL = "userAll",
    SEARCH_TYPE_USER_FOREIGN = "userForeign",
    ENC_TAG = "<[ENC]>",
}

export const enum ConstantInt {
    ROWS_PER_PAGE = 25,
}

export const enum ErrorType {
    OUT_OF_SPACE = "oos",
    TIMEOUT = "timeout",
    AUTH = "auth",
}

export const enum NodeProp {
    ACT_PUB_ID = "apid",
    ACT_PUB_OBJ_TYPE = "ap:objType",
    ACT_PUB_OBJ_CONTENT = "ap:objContent",
    ACT_PUB_OBJ_INREPLYTO = "ap:objInReplyTo",
    ACT_PUB_OBJ_URL = "ap:objUrl",
    ACT_PUB_OBJ_ATTRIBUTED_TO = "ap:objAttributedTo",
    ACT_PUB_USER_ICON_URL = "ap:userIcon",
    ACT_PUB_SHARED_INBOX = "ap:sharedInbox",
    ACT_PUB_USER_IMAGE_URL = "ap:userImage",
    ACT_PUB_ACTOR_ID = "ap:actorId",
    ACT_PUB_ACTOR_URL = "ap:actorUrl",
    ACT_PUB_ACTOR_INBOX = "ap:actorInbox",
    ACT_PUB_SENSITIVE = "ap:nsfw",
    ACT_PUB_TAG = "ap:tag",
    ENC_KEY = "sn:encKey",
    TEMP = "tmp",
    RSS_FEED_SRC = "sn:rssFeedSrc",
    AUDIO_URL = "sn:audioUrl",
    USER_PREF_PUBLIC_KEY = "sn:publicKey",
    USER_PREF_EDIT_MODE = "sn:editMode",
    USER_PREF_SHOW_METADATA = "sn:showMetaData",
    USER_PREF_NSFW = "sn:nsfw",
    USER_PREF_SHOW_PARENTS = "sn:showParents",
    USER_PREF_PASSWORD_RESET_AUTHCODE = "sn:pwdResetAuth",
    USER_PREF_RSS_HEADINGS_ONLY = "sn:rssHeadingsOnly",
    USER_PREF_MAIN_PANEL_COLS = "sn:mainPanelCols",
    SIGNUP_PENDING = "sn:signupPending",
    EMAIL_CONTENT = "sn:content",
    EMAIL_RECIP = "sn:recip",
    EMAIL_SUBJECT = "sn:subject",
    TARGET_ID = "sn:target_id",
    USER = "sn:user",
    DISPLAY_NAME = "sn:displayName",
    MFS_ENABLE = "sn:mfsEnable",
    USER_BIO = "sn:userBio",
    USER_DID_IPNS = "sn:didIPNS",
    USER_IPFS_KEY = "sn:ipfsKey",
    USER_TAGS = "sn:tags",
    PWD_HASH = "sn:pwdHash",
    FILE_SYNC_LINK = "fs:link",
    USER_NODE_ID = "sn:userNodeId",
    NAME = "sn:name",
    IPFS_LINK = "ipfs:link",
    IPFS_CID = "ipfs:cid",
    IPNS_CID = "ipns:cid",
    IPFS_SCID = "ipfs:scid",
    IPFS_REF = "ipfs:ref",
    JSON_HASH = "ipfs:json",
    SAVE_TO_IPFS = "sn:saveToIpfs",
    IPFS_LINK_NAME = "ipfs:linkName",
    IPFS_SOURCE = "ipfs:source",
    FS_LINK = "fs:link",
    IPFS_OK = "ipfs:ok",
    MIME_EXT = "sn:ext",
    EMAIL = "sn:email",
    CODE = "sn:code",
    BIN_MIME = "sn:mimeType",
    BIN_FILENAME = "sn:fileName",
    BIN_SIZE = "sn:size",
    BIN_DATA_URL = "sn:dataUrl",
    JSON_FILE_SEARCH_RESULT = "sn:json",
    NOWRAP = "sn:nowrap",
    BIN_DATA = "sn:jcrData",
    BIN = "bin",
    BIN_URL = "sn:extUrl",
    IMG_WIDTH = "sn:imgWidth",
    IMG_HEIGHT = "sn:imgHeight",
    IMG_SIZE = "sn:imgSize",
    CHILDREN_IMG_SIZES = "sn:childrenImgSizes",
    BIN_TOTAL = "sn:binTot",
    BIN_QUOTA = "sn:binQuota",
    ALLOWED_FEATURES = "sn:features",
    LAST_LOGIN_TIME = "sn:lastLogin",
    LAST_ACTIVE_TIME = "sn:lastActive",
    CRYPTO_KEY_PUBLIC = "sn:cryptoKeyPublic",
    CRYPTO_KEY_PRIVATE = "sn:cryptoKeyPrivate",
    INLINE_CHILDREN = "inlineChildren",
    PRIORITY = "priority",
    PRIORITY_FULL = "p.priority",
    LAYOUT = "layout",
    ORDER_BY = "orderBy",
    NO_OPEN_GRAPH = "noOpenGraph",
    TYPE_LOCK = "sn:typLoc",
    DATE = "date",
    DATE_FULL = "p.date",
    UNPUBLISHED = "unpub",
    DURATION = "duration",
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
    RSS_FEED = "sn:rssfeed",
    RSS_FEEDS = "sn:rssfeeds",
    FRIEND_LIST = "sn:friendList",
    BLOCKED_USERS = "sn:blockedUsers",
    FRIEND = "sn:friend",
    POSTS = "sn:posts",
    ACT_PUB_POSTS = "ap:posts",
    NONE = "u",
    PLAIN_TEXT = "sn:txt",
    FS_FILE = "fs:file",
    FS_FOLDER = "fs:folder",
    FS_LUCENE = "fs:lucene",
    IPFS_NODE = "sn:ipfsNode",
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
