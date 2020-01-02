export class Constants {

    static readonly PUBSUB_RefreshEnablement = "pubsub-refresh-enablement";
    static readonly PUBSUB_SingletonsReady = "pubsub-singletons-ready";

    static readonly ANON: string = "anonymous";
    static readonly LOCALDB_LOGIN_USR: string = "loginUsr";
    static readonly LOCALDB_LOGIN_PWD: string = "loginPwd";

    /*
     * loginState="0" if user logged out intentionally. loginState="1" if last known state of user was 'logged in'
     */
    static readonly LOCALDB_LOGIN_STATE: string = "loginState";

    static readonly INSERT_ATTACHMENT: string = "{{insert-attachment}}";
    static readonly NEW_ON_TOOLBAR: boolean = true;
    static readonly INS_ON_TOOLBAR: boolean = false;
    static readonly MOVE_UPDOWN_ON_TOOLBAR: boolean = true;

    /* showing path on rows just wastes space for ordinary users. Not really needed */
    static readonly SHOW_PATH_ON_ROWS: boolean = true;
    static readonly SHOW_PATH_IN_DLGS: boolean = true;

    static readonly SHOW_CLEAR_BUTTON_IN_EDITOR: boolean = false;

    static readonly ATT_MAX_WIDTH: string = "att-max-width";

    static readonly COMMENT_BY: string = "sn:commentBy";
    static readonly PUBLIC_APPEND: string = "sn:publicAppend";
    static readonly PRIMARY_TYPE: string = "sn:primaryType";

    static readonly EMAIL_CONTENT: string = "sn:content";
    static readonly EMAIL_RECIP: string = "sn:recip";
    static readonly EMAIL_SUBJECT: string = "sn:subject";

    //todo-0: wtf, I also see "sn:pwd" in use in some places????
    static readonly PASSWORD: string = "sn:password";

    //static readonly CONTENT: string = "sn: content";

    static readonly IPFS_NODE: string = "sn:ipfsNode"; 
    
    //This is for bash script names to whow up when browing on the tree
    static readonly NAME: string = "sn:name";
    static readonly FILE_NAME: string = "sn:fileName";

    
    static readonly TAGS: string = "sn:tags";
    static readonly UUID: string = "sn:uuid";
    static readonly JSON_FILE_SEARCH_RESULT: string = "sn:json";
    static readonly PRE: string = "pre";
    static readonly WRAP: string = "wrap";
    
    static readonly ENC: string = "enc";

    static readonly DISABLE_INSERT: string = "sn:disableInsert";

    static readonly PWD: string = "sn:pwd";
    static readonly EMAIL: string = "sn:email";
    static readonly CODE: string = "sn:code";

    static readonly BIN_VER: string = "sn:binVer";
    static readonly BIN_DATA: string = "sn:jcrData";
    static readonly BIN_MIME: string = "sn::mimeType";

    static readonly IMG_WIDTH: string = "sn:imgWidth";
    static readonly IMG_HEIGHT: string = "sn:imgHeight";

    static readonly ENC_TAG = "<[ENC]>";
}


