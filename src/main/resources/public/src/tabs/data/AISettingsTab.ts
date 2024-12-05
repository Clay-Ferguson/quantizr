import { Constants as C } from "../../Constants";
import { TabBase } from "../../intf/TabBase";
import { AISettingsView } from "../AISettingsView";
import { S } from "../../Singletons";

export class AISettingsTab extends TabBase<any, AISettingsView> {
    name = "AI Settings";
    tooltip = "Edit your AI Settings";
    id = C.TAB_AI_SETTINGS;
    static inst: AISettingsTab = null;
    static tabShown: boolean = false;
    static URL_PARAM = "ai-settings";

    constructor() {
        super()
        AISettingsTab.inst = this;
    }

    isVisible() {
        return AISettingsTab.tabShown;
    }

    static selectIfOpened(): boolean {
        if (AISettingsTab.inst.isVisible()) {
            S.tabUtil.selectTab(C.TAB_AI_SETTINGS);
            return true;
        }
        return false;
    }

    constructView(data: TabBase<any, AISettingsView>): AISettingsView {
        return new AISettingsView(data);
    }
}
