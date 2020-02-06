import { CompIntf } from "./widget/base/CompIntf";

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

export interface TextEditorIntf {
    setWordWrap(wordWrap: boolean): void;
    setMode(mode: string): void;
    insertTextAtCursor(text: string): void;
    getValue(): string;
    focus(): void;
    whenElm(func: Function): void;
}

export interface CheckboxIntf {
    setChecked(checked: boolean): void;
    getChecked(): boolean;
}

export class PropEntry {
    //The 'id' is of the EditPropTextarea element. We could theoretially make this hold the ACTUAL EditPropTextarea object reference itself
    //and when doing so probably use an interface of EditPRopTextarea just to be safer against circular references since this interfeces
    //module is imported into pretty much every other module.
    constructor(public property: PropertyInfo, //
        public readOnly: boolean, //
        public binary: boolean,
        public comp?: TextEditorIntf,
        public checkBox?: CheckboxIntf) {
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
    name: string;
    content: string;
    tags: string;
    logicalOrdinal: number;
    ordinal: number;
    owner: string;
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

export interface UserPreferences {
    editMode: boolean;
    importAllowed: boolean;
    exportAllowed: boolean;
    showMetaData: boolean;
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
    siblingOffset: number;
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
}

export interface SetNodeTypeRequest {
    nodeId: string;
    type: string;
}

export interface SetNodeTypeResponse {
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

export interface AnonPageLoadResponse extends ResponseBase {
    content: string;
    renderNodeResponse: RenderNodeResponse;
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

export interface SelectAllNodesResponse extends ResponseBase {
    nodeIds : string[];
}

export interface DeletePropertyResponse extends ResponseBase {
}

export interface ExportResponse extends ResponseBase {
    /* the generated output for the user to now view after exporting */
    fileName: string;
}

export interface GetNodePrivilegesResponse extends ResponseBase {
    aclEntries: AccessControlEntryInfo[];
    owners: string[];
    publicAppend: boolean;
}

export interface NodePrivilegesInfo {
    aclEntries: AccessControlEntryInfo[];
    owners: string[];
    publicAppend: boolean;
}

export interface GetServerInfoResponse extends ResponseBase {
    serverInfo: string;
}

export interface PingResponse extends ResponseBase {
    serverInfo: string;
}

export interface RebuildIndexesResponse extends ResponseBase {
}

export interface ShutdownServerNodeResponse extends ResponseBase {
}

export interface SendTestEmailResponse extends ResponseBase {
}

export interface GenerateNodeHashResponse extends ResponseBase {
    hashInfo: string;
}

export interface CompareSubGraphResponse extends ResponseBase {
    compareInfo: string;
}

export interface GetSharedNodesResponse extends ResponseBase {
    searchResults: NodeInfo[];
}

export interface ImportResponse extends ResponseBase {
}

export interface InitNodeEditResponse extends ResponseBase {
    nodeInfo: NodeInfo;
}

export interface InsertBookResponse extends ResponseBase {
    newNode: NodeInfo;
}

export interface ExecuteNodeResponse extends ResponseBase {
    returnCode: number;
    output: string;
}

export interface ActivityPubPostResponse extends ResponseBase {
    returnCode: number;
    output: string;
}

export interface InsertNodeResponse extends ResponseBase {
    newNode: NodeInfo;
}

export interface AppDropResponse extends ResponseBase {
}

export interface LogoutResponse extends ResponseBase {
}

export interface MoveNodesResponse extends ResponseBase {
}

export interface NodeSearchResponse extends ResponseBase {
    searchResults: NodeInfo[];
}

export interface GraphResponse extends ResponseBase {
    nodes: any[];
    edges: any[];
}

export interface FileSearchResponse extends ResponseBase {
    searchResultNodeId: string;
}

export interface RemovePrivilegeResponse extends ResponseBase {
}

export interface RenderNodeResponse extends ResponseBase {
    node: NodeInfo;
    offsetOfNodeFound: number;

    /* holds true if we hit the end of the list of child nodes */
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

export interface SaveUserPreferencesResponse extends ResponseBase {
}

export interface OpenSystemFileResponse extends ResponseBase {
}

export interface SetNodePositionResponse extends ResponseBase {
}

export interface SignupResponse extends ResponseBase {
}

export interface SplitNodeResponse extends ResponseBase {
}

export interface UploadFromUrlResponse extends ResponseBase {
}

export interface BrowseFolderResponse extends ResponseBase {
    listingJson: string;
}

export interface ResponseBase {
    success: boolean;
    message: string;
    stackTrace: string;
}
