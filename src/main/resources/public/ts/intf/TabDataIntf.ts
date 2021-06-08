import { CompIntf } from "../widget/base/CompIntf";

export interface TabDataIntf {
    // display name shown on the tab
    name: string;

    // DOM ID of the tab button itself, but also the unique identifier for the tab
    id: string;

    constructView(data: TabDataIntf): CompIntf;

    // controls whether to show tab button or not.
    isVisible(): boolean;
}
