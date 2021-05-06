import { SpeechRecogIntf } from "./intf/ SpeechRecogIntf";
import { AttachmentIntf } from "./intf/AttachmentIntf";
import { EditIntf } from "./intf/EditIntf";
import { EncryptionIntf } from "./intf/EncryptionIntf";
import { LocalDBIntf } from "./intf/LocalDBIntf";
import { Meta64Intf } from "./intf/Meta64Intf";
import { NavIntf } from "./intf/NavIntf";
import { PluginMgrIntf } from "./intf/PluginMgrIntf";
import { PropsIntf } from "./intf/PropsIntf";
import { RenderIntf } from "./intf/RenderIntf";
import { SearchIntf } from "./intf/SearchIntf";
import { ServerPushIntf } from "./intf/ServerPushIntf";
import { ShareIntf } from "./intf/ShareIntf";
import { UserIntf } from "./intf/UserIntf";
import { UtilIntf } from "./intf/UtilIntf";
import { ViewIntf } from "./intf/ViewIntf";

/* Similar to a SpringContext in a Java app, these singletons are all pre-instantiated and guaranteed not
to result in any circular-references during load time, because they instantiate only other interfaces */
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
    localDB: LocalDBIntf;
    speech: SpeechRecogIntf;
}
