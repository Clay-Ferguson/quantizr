import { CompIntf } from "../widget/base/CompIntf";

export interface MainTabPanelIntf extends CompIntf {
    setTabVisibility(tabName: string, visible: boolean): void;
}