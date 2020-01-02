import * as I from "../Interfaces";

export interface RssPluginIntf {
    init ();
    renderFeedNode (node: I.NodeInfo, rowStyling: boolean): React.ReactNode ;
}
