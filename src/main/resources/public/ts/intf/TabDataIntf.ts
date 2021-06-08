import { ResultSetInfo } from "../ResultSetInfo";
import { CompIntf } from "../widget/base/CompIntf";

export interface TabDataIntf {
    // display name shown on the tab
    name: string;

    /* DOM ID of the tab button itself, but also the unique identifier for the tab. Note: even if there are perhaps
     multiple different instances of the same AppTab-derived class each one will need to have a unique id. This means
    we can in the future support multiple SearchView tabs opened simultaneously, each with a different ID of course */
    id: string;

    constructView(data: TabDataIntf): CompIntf;

    // controls whether to show tab button or not.
    isVisible(): boolean;

    rsInfo: ResultSetInfo;
}
