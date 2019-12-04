console.log("Interfaces.ts");

/* These are Client-side only models, and are not seen on the server side ever */

/* Function Prototype/Signatore, It is assumed that a return value of false, will abort the iteration, and true continues iterating */
export interface PropertyIterator {
    (prop: string, val: any): boolean;
}

/* Models a time-range in some media where an AD starts and stops */
export class AdSegment {
    constructor(public beginTime: number,//
        public endTime: number) {
    }
}

export class PropEntry {
    //The 'id' is of the EditPropTextarea element. We could theoretially make this hold the ACTUAL EditPropTextarea object reference itself
    //and when doing so probably use an interface of EditPRopTextarea just to be safer against circular references since this interfeces
    //module is imported into pretty much every other module.
    constructor(public id: string, //
        public checkboxId: string, //
        public property: PropertyInfo, //
        public readOnly: boolean, //
        public binary: boolean) {
    }
}

export class SubProp {
    //ID is of the EditPropTextarea element, I can probably make this hold the ACTUAL EditPropTextarea object reference itself
    //but i'm paranoid about introducing more circular ref risk so i leave as a string for now. With ID we can always get comp by Comp.findById()
    constructor(public id: string, //
        public val: string) {
    }
}

export interface AccessControlEntryInfo {
    principalName: string;
    principalNodeId: string;
    privileges: PrivilegeInfo[];
}

export interface NodeInfo {
    id: string;
    path: string;
    content: string;
    tags: string;
    logicalOrdinal: number;
    ordinal: number;
    owner: string;
    type: string;
    properties: PropertyInfo[];
    hasChildren: boolean;
    hasBinary: boolean;
    binaryIsImage: boolean;
    binVer: number;
    width: number;
    height: number;
    uid: string;
    lastModified: number;
    children: NodeInfo[];
}

export interface PrivilegeInfo {
    privilegeName: string;
}

export interface PropertyInfo {
    name: string;
    value?: string;
    abbreviated?: boolean;
}

export interface RefInfo {
    id: string;
    path: string;
}

export interface UserPreferences {
    editMode: boolean;
    advancedMode: boolean;
    importAllowed: boolean;
    exportAllowed: boolean;
    showMetaData: boolean;
    showPath: boolean;
}

export interface AddPrivilegeRequest {
    nodeId: string;
    privileges: string[];
    principal: string;
    publicAppend: boolean;
}

export interface SavePublicKeyRequest {
    keyJson: string;
}

export interface AnonPageLoadRequest {
}

export interface ChangePasswordRequest {
    newPassword: string;
    passCode: string;
}

export interface CloseAccountRequest {
}

export interface CreateSubNodeRequest {
    nodeId: string;
    newNodeName: string;
    typeName: string;
    createAtTop: boolean;
}

export interface DeleteAttachmentRequest {
    nodeId: string;
}

export interface DeleteNodesRequest {
    nodeIds: string[];
}

export interface SelectAllNodesRequest {
    parentNodeId: string;
}

export interface DeletePropertyRequest {
    nodeId: string;
    propName: string;
}

export interface ExportRequest {
    nodeId: string;
    exportExt: string;
}

export interface GetNodePrivilegesRequest {
    nodeId: string;
    includeAcl: boolean;
    includeOwners: boolean;
}

export interface GetServerInfoRequest {
    command?: string;
    nodeId: string;
}

export interface PingRequest {
}

export interface RebuildIndexesRequest {
}

export interface ShutdownServerNodeRequest {
}

export interface SendTestEmailRequest {
}

export interface GenerateNodeHashRequest {
    nodeId: string;
    verify: boolean;
}

export interface CompareSubGraphRequest {
    nodeIdA: string;
    nodeIdB: string;
}

export interface GetSharedNodesRequest {
    nodeId: string;
}

export interface ImportRequest {
    nodeId: string;
    sourceFileName: string;
}

export interface InitNodeEditRequest {
    nodeId: string;
}

export interface LuceneIndexRequest {
    nodeId: string;
    path: string;
}

export interface LuceneSearchRequest {
    nodeId: string;
    text: string;
}

export interface InsertBookRequest {
    nodeId: string;
    bookName: string;
    truncated: boolean;
}

export interface ExecuteNodeRequest {
    nodeId: string;
}

export interface ActivityPubPostRequest {
    nodeId: string;
}

export interface InsertNodeRequest {
    parentId: string;
    targetOrdinal: number;
    newNodeName: string;
    typeName: string;
}

export interface AppDropRequest {
    data: string;
}

export interface LoginRequest {
    userName: string;
    password: string;
    tzOffset: number;
    dst: boolean;
}

export interface LogoutRequest {
}

export interface MoveNodesRequest {
    targetNodeId: string;
    nodeIds: string[];
    location: string;
}

export interface NodeSearchRequest {
    sortDir: string;
    sortField: string;
    nodeId: string;
    searchText: string;
    searchProp: string;
}


export interface GraphRequest {
    nodeId: string;
}

export interface FileSearchRequest {
    nodeId: string;
    searchText: string;
    reindex: boolean
}

export interface RemovePrivilegeRequest {
    nodeId: string;
    principalNodeId: string;
    privilege: string;
}

export interface RenderNodeRequest {
    nodeId: string;
    upLevel: number;
    offset: number;
    renderParentIfLeaf: boolean;
    goToLastPage: boolean;
    forceIPFSRefresh?: boolean;
}

export interface ResetPasswordRequest {
    user: string;
    email: string;
}

export interface SaveNodeRequest {
    nodeId: string;
    content: string;
    name?: string;
    properties: PropertyInfo[];
    sendNotification: boolean;
}

export interface SetNodeTypeRequest {
    nodeId: string;
    type: string;
}

export interface SetNodeTypeResponse {
}

export interface SavePublicKeyResponse {
    message: string;
}

export interface LuceneIndexResponse {
    message: string;
}

export interface LuceneSearchResponse {
    message: string;
}

export interface SavePropertyRequest {
    nodeId: string;
    propertyName: string;
    propertyValue: string;
}

export interface SaveUserPreferencesRequest {
    userPreferences: UserPreferences;
}

export interface OpenSystemFileRequest {
    fileName: string;
}

export interface SetNodePositionRequest {
    nodeId: string;
    targetName: string;
}

export interface SignupRequest {
    userName: string;
    password: string;
    email: string;
    captcha: string;
}

export interface SplitNodeRequest {
    splitType: string;
    nodeId: string;
    delimiter: string;
}

export interface UploadFromUrlRequest {
    nodeId: string;
    sourceUrl: string;
}

export interface BrowseFolderRequest {
    nodeId: string;
}

export interface AddPrivilegeResponse extends OakResponseBase {
}

export interface AnonPageLoadResponse extends OakResponseBase {
    content: string;
    renderNodeResponse: RenderNodeResponse;
}

export interface ChangePasswordResponse extends OakResponseBase {
    user: string;
}

export interface CloseAccountResponse extends OakResponseBase {
}

export interface CreateSubNodeResponse extends OakResponseBase {
    newNode: NodeInfo;
}

export interface DeleteAttachmentResponse extends OakResponseBase {
}

export interface DeleteNodesResponse extends OakResponseBase {
}

export interface SelectAllNodesResponse extends OakResponseBase {
    nodeIds : string[];
}

export interface DeletePropertyResponse extends OakResponseBase {
}

export interface ExportResponse extends OakResponseBase {
    /* the generated output for the user to now view after exporting */
    fileName: string;
}

export interface GetNodePrivilegesResponse extends OakResponseBase {
    aclEntries: AccessControlEntryInfo[];
    owners: string[];
    publicAppend: boolean;
}

export interface GetServerInfoResponse extends OakResponseBase {
    serverInfo: string;
}

export interface PingResponse extends OakResponseBase {
    serverInfo: string;
}

export interface RebuildIndexesResponse extends OakResponseBase {
}

export interface ShutdownServerNodeResponse extends OakResponseBase {
}

export interface SendTestEmailResponse extends OakResponseBase {
}

export interface GenerateNodeHashResponse extends OakResponseBase {
    hashInfo: string;
}

export interface CompareSubGraphResponse extends OakResponseBase {
    compareInfo: string;
}

export interface GetSharedNodesResponse extends OakResponseBase {
    searchResults: NodeInfo[];
}

export interface ImportResponse extends OakResponseBase {
}

export interface InitNodeEditResponse extends OakResponseBase {
    nodeInfo: NodeInfo;
}

export interface InsertBookResponse extends OakResponseBase {
    newNode: NodeInfo;
}

export interface ExecuteNodeResponse extends OakResponseBase {
    returnCode: number;
    output: string;
}

export interface ActivityPubPostResponse extends OakResponseBase {
    returnCode: number;
    output: string;
}

export interface InsertNodeResponse extends OakResponseBase {
    newNode: NodeInfo;
}

export interface AppDropResponse extends OakResponseBase {
}

export interface LoginResponse extends OakResponseBase {
    rootNode: RefInfo;
    userName: string;
    anonUserLandingPageNode: string;
    homeNodeOverride: string;
    userPreferences: UserPreferences;
    allowFileSystemSearch: boolean;
}

export interface LogoutResponse extends OakResponseBase {
}

export interface MoveNodesResponse extends OakResponseBase {
}

export interface NodeSearchResponse extends OakResponseBase {
    searchResults: NodeInfo[];
}

export interface GraphResponse extends OakResponseBase {
    nodes: any[];
    edges: any[];
}

export interface FileSearchResponse extends OakResponseBase {
    searchResultNodeId: string;
}

export interface RemovePrivilegeResponse extends OakResponseBase {
}

export interface RenderNodeResponse extends OakResponseBase {
    node: NodeInfo;
    offsetOfNodeFound: number;

    /* holds true if we hit the end of the list of child nodes */
    endReached: boolean;

    displayedParent: boolean;

    noDataResponse: string;
}

export interface ResetPasswordResponse extends OakResponseBase {
}

export interface SaveNodeResponse extends OakResponseBase {
    node: NodeInfo;
}

export interface SavePropertyResponse extends OakResponseBase {
    propertySaved: PropertyInfo;
}

export interface SaveUserPreferencesResponse extends OakResponseBase {
}

export interface OpenSystemFileResponse extends OakResponseBase {
}

export interface SetNodePositionResponse extends OakResponseBase {
}

export interface SignupResponse extends OakResponseBase {
}

export interface SplitNodeResponse extends OakResponseBase {
}

export interface UploadFromUrlResponse extends OakResponseBase {
}

export interface BrowseFolderResponse extends OakResponseBase {
    listingJson: string;
}

export interface OakResponseBase {
    success: boolean;
    message: string;
}
