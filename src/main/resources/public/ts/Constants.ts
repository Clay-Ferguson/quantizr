export class Constants {

    /* Feature Flags */
    /* ======================================================================== */
    static readonly ENABLE_ACE_EDITOR: boolean = false;
    static readonly INSERT_ATTACHMENT: string = "{{insert-attachment}}";
    static readonly NEW_ON_TOOLBAR: boolean = true;
    static readonly INS_ON_TOOLBAR: boolean = false;
    static readonly MOVE_UPDOWN_ON_TOOLBAR: boolean = true;

    /* showing path on rows just wastes space for ordinary users. Not really needed */
    static readonly SHOW_PATH_IN_DLGS: boolean = true;

    static readonly SHOW_CLEAR_BUTTON_IN_EDITOR: boolean = false;

    /* ======================================================================== */

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

    static readonly ATT_MAX_WIDTH: string = "att-max-width";

    // static readonly PAY_PAL_BUTTON: string = `<form action='https://www.paypal.com/cgi-bin/webscr' method='post' target='_blank'>
    // <input type='hidden' name='cmd' value='_donations' />
    // <input type='hidden' name='business' value='YD984BLHTSZYL' />
    // <input type='hidden' name='currency_code' value='USD' />
    // <input type='image' src='https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif' border='0' name='submit' title='PayPal - The safer, easier way to pay online!' alt='Donate with PayPal button' />
    // <img alt='' border='0' src='https://www.paypal.com/en_US/i/scr/pixel.gif' width='1' height='1' />
    // </form>`;

    //todo-0: this button does get altered the same the other markdown links and images get tweaked by the async lookup and modify of it.
    static readonly PAY_PAL_BUTTON: string = `
    <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=YD984BLHTSZYL&currency_code=USD&source=url" target="_blank">
    <img src='/images/btn_donateCC_LG.gif' 
        border='0' 
        title='PayPal - The safer, easier way to pay online!' 
        alt='Donate with PayPal button'/> 
    <a/>`;
}


