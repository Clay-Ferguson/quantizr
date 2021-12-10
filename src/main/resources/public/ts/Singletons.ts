import type { SpeechRecog } from "./SpeechRecog";
import type { Attachment } from "./Attachment";
import type { Edit } from "./Edit";
import type { Encryption } from "./Encryption";
import type { LocalDB } from "./LocalDB";
import type { Quanta } from "./Quanta";
import type { Nav } from "./Nav";
import type { PluginMgr } from "./PluginMgr";
import type { Props } from "./Props";
import type { Render } from "./Render";
import type { Search } from "./Search";
import type { ServerPush } from "./ServerPush";
import type { User } from "./User";
import type { Util } from "./Util";
import type { View } from "./View";
import type { Torrent } from "./Torrent";

/* Similar to a SpringContext in a Java app, these singletons are all pre-instantiated and guaranteed not
to result in any circular-references during load time, because they instantiate only other interfaces */
export interface Singletons {
    quanta: Quanta;
    plugin: PluginMgr;
    util: Util;
    push: ServerPush;
    edit: Edit;
    attachment: Attachment;
    encryption: Encryption;
    nav: Nav;
    props: Props;
    render: Render;
    srch: Search;
    user: User;
    view: View;
    localDB: LocalDB;
    speech: SpeechRecog;
    torrent: Torrent;
}
