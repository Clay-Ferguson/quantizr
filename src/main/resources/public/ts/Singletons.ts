import { Meta64Intf } from "./intf/Meta64Intf";
import { AttachmentIntf } from "./intf/AttachmentIntf";
import { EditIntf } from "./intf/EditIntf";
import { EncryptionIntf } from "./intf/EncryptionIntf";
import { NavIntf } from "./intf/NavIntf";
import { PodcastIntf } from "./intf/PodcastIntf";
import { PropsIntf } from "./intf/PropsIntf";
import { RenderIntf } from "./intf/RenderIntf";
import { SearchIntf } from "./intf/SearchIntf";
import { ShareIntf } from "./intf/ShareIntf";
import { UserIntf } from "./intf/UserIntf";
import { UtilIntf } from "./intf/UtilIntf";
import { ViewIntf } from "./intf/ViewIntf";
import { RSSReaderIntf } from "./intf/RSSReaderIntf";
import { ActivityPubIntf } from "./intf/ActivityPubIntf";
import { GraphIntf } from "./intf/GraphIntf";
import { ServerPushIntf } from "./intf/ServerPushIntf";
import { LocalDBIntf } from "./intf/LocalDBIntf";
import { PluginMgrIntf } from "./intf/PluginMgrIntf";
import { DialogBaseImpl } from "./DialogBaseImpl";
import { IPFSUtilIntf } from "./intf/IPFSUtilIntf";

/* NOTE: If this Singleton pattern looks countrary to good module design, keep in mind all module systems
are susceptible to circular references, and these Singtons are an unbreakable solution to that 
issue, due to the delayed pub-sub way of injecting them into wherever we need them. */
export interface Singletons {
    meta64: Meta64Intf;
    plugin: PluginMgrIntf;
    util: UtilIntf;
    ipfsUtil: IPFSUtilIntf;
    push: ServerPushIntf;
    edit: EditIntf;
    attachment: AttachmentIntf;
    encryption: EncryptionIntf;
    nav: NavIntf;
    props: PropsIntf;
    render: RenderIntf;
    graph: GraphIntf;
    srch: SearchIntf;
    share: ShareIntf;
    user: UserIntf;
    view: ViewIntf;
    activityPub: ActivityPubIntf;
    podcast: PodcastIntf;
    rssReader: RSSReaderIntf;
    localDB: LocalDBIntf;
    mainMenu: DialogBaseImpl;

    e: Function; //React.createElement
    log: Function; //console.log
}
