import { Constants as C } from "../../Constants";
import { TabBase } from "../../intf/TabBase";
import { SettingsView } from "../SettingsView";

export class SettingsTab extends TabBase<any> {
    name = "Settings";
    tooltip = "Edit your Account Settings";
    id = C.TAB_SETTINGS;
    static inst: SettingsTab = null;
    static tabShown: boolean = false;

    constructor() {
        super();
        SettingsTab.inst = this;
    }

    isVisible() {
        return SettingsTab.tabShown;
    };

    constructView(data: TabBase) {
        return new SettingsView(data);
    }
}
