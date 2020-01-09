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
import { RssPluginIntf } from "./intf/RssPluginIntf";
import { BashPluginIntf } from "./intf/BashPluginIntf";
import { CoreTypesPluginIntf } from "./intf/CoreTypesPluginIntf";
import { RSSReaderIntf } from "./intf/RSSReaderIntf";
import { ActivityPubIntf } from "./intf/ActivityPubIntf";
import { PasswordPlugin } from "./plugins/PasswordPlugin";
import { GraphIntf } from "./intf/GraphIntf";
import { LuceneIndexPluginIntf } from "./intf/LuceneIndexPluginIntf";
import { ServerPushIntf } from "./intf/ServerPushIntf";
import { LocalDB } from "./LocalDB";
import { LocalDBIntf } from "./intf/LocalDBIntf";

/* NOTE: If this Singleton pattern looks countrary to good module design, keep in mind all module systems
are susceptible to circular references, and these Singtons are an unbreakable solution to that 
issue, due to the delayed pub-sub way of injecting them into wherever we need them. */
export interface Singletons {
    meta64: Meta64Intf;
    util: UtilIntf;
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
    //systemFolder: SystemFolderIntf;
    rssPlugin: RssPluginIntf;
    coreTypesPlugin: CoreTypesPluginIntf;
    bashPlugin: BashPluginIntf;
    luceneIndexPlugin: LuceneIndexPluginIntf;
    passwordPlugin: PasswordPlugin;
    rssReader: RSSReaderIntf;
    localDB: LocalDBIntf;

    //React.createElement
    e: Function;
}
