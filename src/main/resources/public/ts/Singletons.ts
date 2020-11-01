import { ActivityPubIntf } from "./intf/ActivityPubIntf";
import { AttachmentIntf } from "./intf/AttachmentIntf";
import { EditIntf } from "./intf/EditIntf";
import { EncryptionIntf } from "./intf/EncryptionIntf";
import { LocalDBIntf } from "./intf/LocalDBIntf";
import { Meta64Intf } from "./intf/Meta64Intf";
import { NavIntf } from "./intf/NavIntf";
import { PluginMgrIntf } from "./intf/PluginMgrIntf";
import { PropsIntf } from "./intf/PropsIntf";
import { RenderIntf } from "./intf/RenderIntf";
import { RSSReaderIntf } from "./intf/RSSReaderIntf";
import { SearchIntf } from "./intf/SearchIntf";
import { ServerPushIntf } from "./intf/ServerPushIntf";
import { ShareIntf } from "./intf/ShareIntf";
import { UserIntf } from "./intf/UserIntf";
import { UtilIntf } from "./intf/UtilIntf";
import { ViewIntf } from "./intf/ViewIntf";

/* NOTE: If this Singleton pattern looks countrary to good module design, keep in mind all module systems
are susceptible to circular references, and these Singtons are an unbreakable solution to that
issue, due to the delayed pub-sub way of injecting them into wherever we need them. */
export interface Singletons {
    meta64: Meta64Intf;
    plugin: PluginMgrIntf;
    util: UtilIntf;
    push: ServerPushIntf;
    edit: EditIntf;
    attachment: AttachmentIntf;
    encryption: EncryptionIntf;
    nav: NavIntf;
    props: PropsIntf;
    render: RenderIntf;
    srch: SearchIntf;
    share: ShareIntf;
    user: UserIntf;
    view: ViewIntf;
    activityPub: ActivityPubIntf;
    rssReader: RSSReaderIntf;
    localDB: LocalDBIntf;

    e: Function; // React.createElement
    log: Function; // console.log
}
