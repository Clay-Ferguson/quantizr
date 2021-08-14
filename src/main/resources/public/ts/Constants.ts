export class Constants {

    // max rows to allow to scroll in via infinite scroll capability before we reset back to 25 rows.
    static MAX_DYNAMIC_ROWS = 200;

    static TREE_INFINITE_SCROLL = true;
    static FEED_INFINITE_SCROLL = true;

    static ID_LHS = "leftNavPanelId";
    static ID_TAB = "tabPanelId";
    static ID_RHS = "rightNavPanelId";

    static TAB_MAIN: string = "mainTab";
    static TAB_SEARCH: string = "resultSetView";
    static TAB_SHARES: string = "sharedNodesResultSetView";
    static TAB_TIMELINE: string = "timelineResultSetView";
    static TAB_FOLLOWERS: string = "followersResultSetView";
    static TAB_FOLLOWING: string = "followingResultSetView";
    static TAB_FEED: string = "feedTab";
    static TAB_TRENDING: string = "trendingTab";
    static TAB_SERVERINFO: string = "serverInfoTab";
    static TAB_LOG: string = "logTab"

    static SITE_NAV_MENU_TEXT = "Site Nav";

    static leftNavPanelCols: number = 3;

    static readonly ONE_MB = 1048576; // 1024 * 1024;
    static readonly MAX_UPLOAD_MB = 20;

    /* Feature Flags */
    /* ======================================================================== */
    /* Ace editor is disabled because it doesn't have spell-checker and I decided spellchecking is a requirement */
    static readonly ENABLE_ACE_EDITOR: boolean = false;

    static readonly NEW_ON_ROOT: boolean = false;
    static readonly NEW_ON_TOOLBAR: boolean = true;
    static readonly INS_ON_TOOLBAR: boolean = false;
    static readonly MOVE_UPDOWN_ON_TOOLBAR: boolean = true;
    static readonly SHOW_CLEAR_BUTTON_IN_EDITOR: boolean = false;

    /* ======================================================================== */

    static readonly PUBSUB_SingletonsReady = "PUBSUB_SingletonsReady";
    static readonly PUBSUB_mainWindowScroll = "PUBSUB_mainWindowScroll";
    static readonly PUBSUB_postMainWindowScroll = "PUBSUB_postMainWindowScroll";
    static readonly PUBSUB_tabChanging = "PUBSUB_tabChanging";

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
    static readonly LOCALDB_MOUSE_EFFECT: string = "mouseEffect";

    static readonly LOCALDB_AUDIO_SOURCE: string = "audioSource";
    static readonly LOCALDB_VIDEO_SOURCE: string = "videoSource";

    static readonly ATT_MAX_WIDTH: string = "att-max-width";

    // static readonly PAY_PAL_BUTTON: string = `<form action='https://www.paypal.com/cgi-bin/webscr' method='post' target='_blank'>
    // <input type='hidden' name='cmd' value='_donations' />
    // <input type='hidden' name='business' value='YD984BLHTSZYL' />
    // <input type='hidden' name='currency_code' value='USD' />
    // <input type='image' src='https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif' border='0' name='submit' title='PayPal - The safer, easier way to pay online!' alt='Donate with PayPal button' />
    // <img alt='' border='0' src='https://www.paypal.com/en_US/i/scr/pixel.gif' width='1' height='1' />
    // </form>`;

    static readonly PAY_PAL_BUTTON: string = `
    <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=YD984BLHTSZYL&currency_code=USD&source=url" target="_blank">
    <img src='/images/btn_donateCC_LG.gif' 
        border='0' 
        title='PayPal - The safer, easier way to pay online!' 
        alt='Donate with PayPal button'/> 
    </a>`;
}
