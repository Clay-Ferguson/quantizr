import * as I from "../Interfaces";
import * as J from "../JavaIntf";

export interface RssPluginIntf {
    init ();
    renderFeedNode (node: I.NodeInfo, rowStyling: boolean): React.ReactNode ;
}
