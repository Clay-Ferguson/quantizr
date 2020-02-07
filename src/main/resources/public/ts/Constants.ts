export class Constants {

    static readonly PUBSUB_SingletonsReady = "pubsub-singletons-ready";

    static readonly LOCALDB_LOGIN_USR: string = "loginUsr";
    static readonly LOCALDB_LOGIN_PWD: string = "loginPwd";

    /*
     * loginState="0" if user logged out intentionally. loginState="1" if last known state of user was 'logged in'
     */
    static readonly LOCALDB_LOGIN_STATE: string = "loginState";

    /* These two persist what the user is viewing so when the come back later we can go to same node
     location they were last viewing */
    static readonly LOCALDB_LAST_PARENT_NODEID: string = "lastParentId";
    static readonly LOCALDB_LAST_CHILD_NODEID: string = "lastChildId";

    static readonly INSERT_ATTACHMENT: string = "{{insert-attachment}}";
    static readonly NEW_ON_TOOLBAR: boolean = true;
    static readonly INS_ON_TOOLBAR: boolean = false;
    static readonly MOVE_UPDOWN_ON_TOOLBAR: boolean = true;

    /* showing path on rows just wastes space for ordinary users. Not really needed */
    static readonly SHOW_PATH_IN_DLGS: boolean = true;

    static readonly SHOW_CLEAR_BUTTON_IN_EDITOR: boolean = false;

    static readonly ATT_MAX_WIDTH: string = "att-max-width";
    static readonly PRIMARY_TYPE: string = "sn:primaryType";

    static readonly EMAIL_CONTENT: string = "sn:content";
    static readonly EMAIL_RECIP: string = "sn:recip";
    static readonly EMAIL_SUBJECT: string = "sn:subject";

    static readonly IPFS_NODE: string = "sn:ipfsNode"; 
    
    //This is for bash script names to whow up when browing on the tree
    static readonly NAME: string = "sn:name";
    static readonly FILE_NAME: string = "sn:fileName";

    static readonly UUID: string = "sn:uuid";
    static readonly JSON_FILE_SEARCH_RESULT: string = "sn:json";
    static readonly PRE: string = "sn:pre";
    static readonly NOWRAP: string = "sn:nowrap";
    
    static readonly EMAIL: string = "sn:email";
    static readonly CODE: string = "sn:code";

    static readonly BIN_VER: string = "sn:binVer";
    static readonly BIN_DATA: string = "sn:jcrData";
    static readonly BIN_MIME: string = "sn::mimeType";

    //todo-0: should this be "sn:" prefixed?
    static readonly BIN: string = "bin";

    static readonly IMG_WIDTH: string = "sn:imgWidth";
    static readonly IMG_HEIGHT: string = "sn:imgHeight";
}


