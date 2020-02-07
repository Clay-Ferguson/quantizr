/* tslint:disable */
/* eslint-disable */
// Generated using typescript-generator version 2.19.577 on 2020-02-07 14:17:42.

export interface ActivityPubPostRequest extends RequestBase {
    nodeId: string;
}

export interface AddPrivilegeRequest extends RequestBase {
    nodeId: string;
    privileges: string[];
    principal: string;
    publicAppend: boolean;
}

export interface AnonPageLoadRequest extends RequestBase {
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
    newNodeName: string;
    typeName: string;
    createAtTop: boolean;
}

export interface DeleteAttachmentRequest extends RequestBase {
    nodeId: string;
}

export interface DeleteNodesRequest extends RequestBase {
    nodeIds: string[];
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

export interface NodeSearchRequest extends RequestBase {
    sortDir: string;
    sortField: string;
    nodeId: string;
    searchText: string;
    searchProp: string;
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
    forceIPFSRefresh: boolean;
}

export interface ResetPasswordRequest extends RequestBase {
    user: string;
    email: string;
}

export interface SaveNodeRequest extends RequestBase {
    nodeId: string;
    properties: PropertyInfo[];
    content: string;
    name: string;
}

export interface SavePropertyRequest extends RequestBase {
    nodeId: string;
    propertyName: string;
    propertyValue: string;
}

export interface SavePublicKeyRequest extends RequestBase {
    keyJson: string;
}

export interface SaveUserPreferencesRequest extends RequestBase {
    userPreferences: UserPreferences;
}

export interface SelectAllNodesRequest extends RequestBase {
    parentNodeId: string;
}

export interface SendTestEmailRequest extends RequestBase {
}

export interface SetNodePositionRequest extends RequestBase {
    nodeId: string;
    targetName: string;
}

export interface SetNodeTypeRequest extends RequestBase {
    nodeId: string;
    type: string;
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

export interface UploadFromUrlRequest extends RequestBase {
    nodeId: string;
    sourceUrl: string;
}

export interface RequestBase {
}

export interface ActivityPubPostResponse extends ResponseBase {
}

export interface AddPrivilegeResponse extends ResponseBase {
}

export interface AnonPageLoadResponse extends ResponseBase {
    content: string;
    renderNodeResponse: RenderNodeResponse;
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

export interface FileSearchResponse extends ResponseBase {
    searchResultNodeId: string;
}

export interface FileSystemReindexResponse extends ResponseBase {
    report: string;
}

export interface GetNodePrivilegesResponse extends ResponseBase {
    aclEntries: AccessControlEntryInfo[];
    owners: string[];
    publicAppend: boolean;
}

export interface GetPublicServerInfoResponse extends ResponseBase {
    serverInfo: string;
}

export interface GetServerInfoResponse extends ResponseBase {
    serverInfo: string;
}

export interface GetSharedNodesResponse extends ResponseBase {
    searchResults: NodeInfo[];
}

export interface GraphResponse extends ResponseBase {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

export interface ImportResponse extends ResponseBase {
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
}

export interface SavePropertyResponse extends ResponseBase {
    propertySaved: PropertyInfo;
}

export interface SavePublicKeyResponse extends ResponseBase {
}

export interface SaveUserPreferencesResponse extends ResponseBase {
}

export interface SelectAllNodesResponse extends ResponseBase {
    nodeIds: string[];
}

export interface SendTestEmailResponse extends ResponseBase {
}

export interface SetNodePositionResponse extends ResponseBase {
}

export interface SetNodeTypeResponse extends ResponseBase {
}

export interface ShutdownServerNodeResponse extends ResponseBase {
}

export interface SignupResponse extends ResponseBase {
}

export interface SplitNodeResponse extends ResponseBase {
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
}

export interface PropertyInfo {
    name: string;
    value: string;
}

export interface UserPreferences {
    editMode: boolean;
    showMetaData: boolean;
    importAllowed: boolean;
    exportAllowed: boolean;
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
    hasChildren: boolean;
    firstChild: boolean;
    lastChild: boolean;
    hasBinary: boolean;
    binaryIsImage: boolean;
    binVer: number;
    width: number;
    height: number;
    children: NodeInfo[];
    imgId: string;
    owner: string;
}

export interface AccessControlEntryInfo {
    principalName: string;
    principalNodeId: string;
    privileges: PrivilegeInfo[];
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

export interface PrivilegeInfo {
    privilegeName: string;
}

export const enum NodeProp {
    ENC = "sn:enc",
    ENC_TAG = "<[ENC]>",
}
