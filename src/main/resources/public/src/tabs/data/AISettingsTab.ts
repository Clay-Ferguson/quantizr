import { Constants as C } from "../../Constants";
import { TabBase } from "../../intf/TabBase";
import { AISettingsView } from "../AISettingsView";

export class AISettingsTab extends TabBase<any> {
    name = "AI Settings";
    tooltip = "Edit your AI Settings";
    id = C.TAB_AI_SETTINGS;
    static inst: AISettingsTab = null;
    static tabShown: boolean = false;

    constructor() {
        super()
        AISettingsTab.inst = this;
    }

    isVisible() {
        return AISettingsTab.tabShown;
    }

    constructView(data: TabBase) {
        return new AISettingsView(data);
    }
}
