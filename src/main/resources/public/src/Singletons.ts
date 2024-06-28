import type { DomUtil } from "./DomUtil";
import type { Edit } from "./Edit";
import type { Crypto } from "./Crypto";
import type { LocalDB } from "./LocalDB";
import type { Nav } from "./Nav";
import type { NodeUtil } from "./NodeUtil";
import type { PluginMgr } from "./PluginMgr";
import type { Props } from "./Props";
import type { Quanta } from "./Quanta";
import type { TourUtils } from "./TourUtils";
import type { Render } from "./Render";
import { RpcUtil } from "./RpcUtil";
import type { Search } from "./Search";
import type { ServerPush } from "./ServerPush";
import type { SpeechEngine } from "./SpeechEngine";
import type { TabUtil } from "./TabUtil";
import type { User } from "./User";
import type { Util } from "./Util";
import type { View } from "./View";
import { HistoryUtil } from "./HistoryUtil";
import { Attach } from "./Attach";
import { AIUtil } from "./AIUtil";

/* Similar to a SpringContext in a Java app, these singletons are all pre-instantiated and
guaranteed not to result in any circular-references during load time, because they instantiate only
other interfaces 

IMPORTANT: These are all initialied in Factory.ts
*/
export interface Singletons {
    quanta: Quanta;
    tourUtils: TourUtils;
    plugin: PluginMgr;
    util: Util;
    aiUtil: AIUtil;
    domUtil: DomUtil;
    rpcUtil: RpcUtil;
    nodeUtil: NodeUtil;
    histUtil: HistoryUtil;
    tabUtil: TabUtil;
    push: ServerPush;
    edit: Edit;
    attachment: Attach;
    crypto: Crypto;
    nav: Nav;
    props: Props;
    render: Render;
    srch: Search;
    user: User;
    view: View;
    localDB: LocalDB;
    speech: SpeechEngine;
}

const S: Singletons = {} as any;
(window as any).S = S;
export { S };
