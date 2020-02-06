import * as I from "../Interfaces";
import * as J from "../JavaIntf";

export interface RssPluginIntf {
    init ();
    renderFeedNode (node: J.NodeInfo, rowStyling: boolean): React.ReactNode ;
}
