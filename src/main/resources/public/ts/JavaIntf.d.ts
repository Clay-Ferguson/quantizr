/* tslint:disable */
/* eslint-disable */

export interface ActivityPubPostRequest extends RequestBase {
    nodeId: string;
}

export interface AddPrivilegeRequest extends RequestBase {
    nodeId: string;
    privileges: string[];
    principal: string;
}

export interface AppDropRequest extends RequestBase {
    data: string;
}

export interface BrowseFolderRequest extends RequestBase {
    nodeId: string;
}

export interface ChangePasswordRequest extends RequestBase {
    newPassword: string;
    passCode: string;
}

export interface CloseAccountRequest extends RequestBase {
}

export interface CreateSubNodeRequest extends RequestBase {
    nodeId: string;
    content: string;
    newNodeName: string;
    typeName: string;
    createAtTop: boolean;
    typeLock: boolean;
}

export interface DeleteAttachmentRequest extends RequestBase {
    nodeId: string;
}

export interface DeleteNodesRequest extends RequestBase {
    nodeIds: string[];
    hardDelete: boolean;
}

export interface DeletePropertyRequest extends RequestBase {
    nodeId: string;
    propName: string;
}

export interface ExecuteNodeRequest extends RequestBase {
    nodeId: string;
}

export interface ExportRequest extends RequestBase {
    nodeId: string;
    exportExt: string;
}

export interface FileSearchRequest extends RequestBase {
    searchText: string;
    reindex: boolean;
    nodeId: string;
}

export interface FileSystemReindexRequest extends RequestBase {
    nodeId: string;
}

export interface GetFriendsRequest extends RequestBase {
}

export interface GetNodePrivilegesRequest extends RequestBase {
    nodeId: string;
    includeAcl: boolean;
    includeOwners: boolean;
}

export interface GetServerInfoRequest extends RequestBase {
    command: string;
    nodeId: string;
}

export interface GetSharedNodesRequest extends RequestBase {
    nodeId: string;
    shareTarget: string;
}

export interface GetUserAccountInfoRequest extends RequestBase {
}

export interface GetUserProfileRequest extends RequestBase {
}

export interface GraphRequest extends RequestBase {
    nodeId: string;
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
    parentId: string;
    targetOrdinal: number;
    newNodeName: string;
    typeName: string;
    initialValue: string;
}

export interface LoginRequest extends RequestBase {
    userName: string;
    password: string;
    tzOffset: number;
    dst: boolean;
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
    nodeId: string;
}

export interface NodeSearchRequest extends RequestBase {
    sortDir: string;
    sortField: string;
    nodeId: string;
    searchText: string;
    searchProp: string;
    fuzzy: boolean;
    caseSensitive: boolean;
    searchDefinition: string;
}

export interface OpenSystemFileRequest extends RequestBase {
    fileName: string;
}

export interface PingRequest extends RequestBase {
}

export interface RebuildIndexesRequest extends RequestBase {
}

export interface RemovePrivilegeRequest extends RequestBase {
    nodeId: string;
    principalNodeId: string;
    privilege: string;
}

export interface RenderNodeRequest extends RequestBase {
    nodeId: string;
    offset: number;
    siblingOffset: number;
    upLevel: number;
    renderParentIfLeaf: boolean;
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
    userPreferences: UserPreferences;
}

export interface SaveUserProfileRequest extends RequestBase {
    userName: string;
    userBio: string;
}

export interface SelectAllNodesRequest extends RequestBase {
    parentNodeId: string;
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

export interface ShutdownServerNodeRequest extends RequestBase {
}

export interface SignupRequest extends RequestBase {
    userName: string;
    password: string;
    email: string;
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

export interface UploadFromUrlRequest extends RequestBase {
    nodeId: string;
    sourceUrl: string;
}

export interface RequestBase {
}

export interface ActivityPubPostResponse extends ResponseBase {
}

export interface AddPrivilegeResponse extends ResponseBase {
    principalPublicKey: string;
    principalNodeId: string;
}

export interface AppDropResponse extends ResponseBase {
}

export interface BrowseFolderResponse {
    listingJson: string;
}

export interface ChangePasswordResponse extends ResponseBase {
    user: string;
}

export interface CloseAccountResponse extends ResponseBase {
}

export interface CreateSubNodeResponse extends ResponseBase {
    newNode: NodeInfo;
}

export interface DeleteAttachmentResponse extends ResponseBase {
}

export interface DeleteNodesResponse extends ResponseBase {
}

export interface DeletePropertyResponse extends ResponseBase {
}

export interface ExecuteNodeResponse extends ResponseBase {
    returnCode: number;
    output: string;
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
    userName: string;
}

export interface GetFriendsResponse extends ResponseBase {
    friends: FriendInfo[];
}

export interface GetNodePrivilegesResponse extends ResponseBase {
    aclEntries: AccessControlInfo[];
    owners: string[];
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

export interface GetUserAccountInfoResponse extends ResponseBase {
    binTotal: number;
    binQuota: number;
}

export interface GetUserProfileResponse extends ResponseBase {
    userName: string;
    userBio: string;
    avatarVer: string;
    userNodeId: string;
}

export interface GraphResponse extends ResponseBase {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

export interface ImportResponse extends ResponseBase {
}

export interface InboxPushInfo extends ServerPushInfo {
    nodeId: string;
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

export interface LoginResponse extends ResponseBase {
    rootNode: string;
    rootNodePath: string;
    userName: string;
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

export interface NodeFeedResponse extends ResponseBase {
    searchResults: NodeInfo[];
}

export interface NodeSearchResponse extends ResponseBase {
    searchResults: NodeInfo[];
}

export interface OpenSystemFileResponse extends ResponseBase {
}

export interface PingResponse extends ResponseBase {
    serverInfo: string;
}

export interface RebuildIndexesResponse extends ResponseBase {
}

export interface RemovePrivilegeResponse extends ResponseBase {
}

export interface RenderNodeResponse extends ResponseBase {
    node: NodeInfo;
    offsetOfNodeFound: number;
    endReached: boolean;
    displayedParent: boolean;
    noDataResponse: string;
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

export interface SelectAllNodesResponse extends ResponseBase {
    nodeIds: string[];
}

export interface SendTestEmailResponse extends ResponseBase {
}

export interface ServerPushInfo {
    type: string;
}

export interface SetCipherKeyResponse extends ResponseBase {
}

export interface SetNodePositionResponse extends ResponseBase {
}

export interface ShutdownServerNodeResponse extends ResponseBase {
}

export interface SignupResponse extends ResponseBase {
}

export interface SplitNodeResponse extends ResponseBase {
}

export interface TransferNodeResponse extends ResponseBase {
}

export interface UploadFromUrlResponse extends ResponseBase {
}

export interface WebFingerAcctResourceResponse {
    subject: string;
    links: WebFingerLink[];
}

export interface ResponseBase {
    success: boolean;
    message: string;
    stackTrace: string;
    exceptionClass: string;
    exceptionType: string;
}

export interface NodeInfo {
    id: string;
    name: string;
    content: string;
    lastModified: Date;
    logicalOrdinal: number;
    ordinal: number;
    type: string;
    properties: PropertyInfo[];
    ac: AccessControlInfo[];
    hasChildren: boolean;
    deleted: boolean;
    cipherKey: string;
    firstChild: boolean;
    lastChild: boolean;
    width: number;
    height: number;
    parent: NodeInfo;
    children: NodeInfo[];
    imgId: string;
    owner: string;
    ownerId: string;
    dataUrl: string;
    avatarVer: string;
}

export interface UserPreferences {
    editMode: boolean;
    showMetaData: boolean;
    importAllowed: boolean;
    exportAllowed: boolean;
    maxUploadFileSize: number;
}

export interface AccessControlInfo {
    principalName: string;
    principalNodeId: string;
    privileges: PrivilegeInfo[];
    publicKey: string;
}

export interface GraphNode {
    id: string;
    label: string;
}

export interface GraphEdge {
    to: string;
    from: string;
}

export interface WebFingerLink {
    rel: string;
    type: string;
    href: string;
}

export interface PropertyInfo {
    name: string;
    value: string;
}

export interface PrivilegeInfo {
    privilegeName: string;
}

export const enum Constant {
    ENC_TAG = "<[ENC]>",
}

export const enum NodeProp {
    ENC_KEY = "sn:encKey",
    RSS_FEED_SRC = "sn:rssFeedSrc",
    USER_PREF_PUBLIC_KEY = "sn:publicKey",
    USER_PREF_EDIT_MODE = "sn:editMode",
    USER_PREF_SHOW_METADATA = "sn:showMetaData",
    USER_PREF_IMPORT_ALLOWED = "sn:importAllowed",
    USER_PREF_EXPORT_ALLOWED = "sn:exportAllowed",
    USER_PREF_PASSWORD_RESET_AUTHCODE = "sn:pwdResetAuth",
    SIGNUP_PENDING = "sn:signupPending",
    EMAIL_CONTENT = "sn:content",
    EMAIL_RECIP = "sn:recip",
    EMAIL_SUBJECT = "sn:subject",
    TARGET_ID = "sn:target_id",
    USER = "sn:user",
    USER_BIO = "sn:userBio",
    PWD_HASH = "sn:pwdHash",
    FILE_SYNC_LINK = "fs:link",
    USER_NODE_ID = "sn:userNodeId",
    FILENAME = "sn:fileName",
    NAME = "sn:name",
    IPFS_LINK = "ipfs:link",
    IPFS_LINK_NAME = "ipfs:linkName",
    FS_LINK = "fs:link",
    IPFS_OK = "ipfs:ok",
    MIME_EXT = "sn:ext",
    EMAIL = "sn:email",
    CODE = "sn:code",
    BIN_MIME = "sn:mimeType",
    BIN_FILENAME = "sn:fileName",
    BIN_SIZE = "sn:size",
    BIN_DATA_URL = "sn:dataUrl",
    FILE_NAME = "sn:fileName",
    JSON_FILE_SEARCH_RESULT = "sn:json",
    NOWRAP = "sn:nowrap",
    BIN_DATA = "sn:jcrData",
    BIN = "bin",
    IMG_WIDTH = "sn:imgWidth",
    IMG_HEIGHT = "sn:imgHeight",
    IMG_SIZE = "sn:imgSize",
    BIN_TOTAL = "sn:binTot",
    LAST_LOGIN_TIME = "sn:lastLogin",
    LAST_INBOX_NOTIFY_TIME = "sn:lastInboxNotify",
    BIN_QUOTA = "sn:binQuota",
    INLINE_CHILDREN = "inlineChildren",
    PRIORITY = "priority",
    LAYOUT = "layout",
    ORDER_BY = "orderBy",
    TYPE_LOCK = "sn:typLoc",
}

export const enum NodeType {
    ACCOUNT = "sn:account",
    REPO_ROOT = "sn:repoRoot",
    TRASH_BIN = "sn:trashBin",
    INBOX = "sn:inbox",
    INBOX_ENTRY = "sn:inboxEntry",
    NOTES = "sn:notes",
    RSS_FEED = "sn:rssfeed",
    FRIEND_LIST = "sn:friendList",
    FRIEND = "sn:friend",
    USER_FEED = "sn:userFeed",
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
    ADD_CHILDREN = "ac",
    REMOVE_CHILDREN = "rc",
}
