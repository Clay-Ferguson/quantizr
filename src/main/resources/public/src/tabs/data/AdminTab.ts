import { getAs } from "../../AppContext";
import { AppTab } from "../../comp/AppTab";
import { Constants as C } from "../../Constants";
import { TabBase } from "../../intf/TabBase";
import { AdminView } from "../AdminView";

export class AdminTab extends TabBase<any> {
    name = "Admin";
    tooltip = "Manage the Server Instance";
    id = C.TAB_ADMIN;
    static inst: AdminTab = null;
    static tabSelected: boolean = false;

    constructor() {
        super();
        AdminTab.inst = this;
    }

    isVisible() {
        return getAs().isAdminUser;
    }

    constructView(data: TabBase): AppTab { 
        return new AdminView(data); 
    }
}
