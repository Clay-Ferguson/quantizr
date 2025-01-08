import { Constants as C } from "../../Constants";
import { TabBase } from "../../intf/TabBase";
import { AdminView } from "../AdminView";

export class AdminTab extends TabBase<any> {
    name = "Server Admin";
    tooltip = "Manage the Server Instance";
    id = C.TAB_ADMIN;
    static inst: AdminTab = null;
    static tabSelected: boolean = false;

    constructor() {
        super();
        AdminTab.inst = this;
    }

    isVisible() {
        return AdminTab.tabSelected; //getAs().isAdminUser;
    }

    onActivate(): void {
        AdminTab.tabSelected = true;
    }

    constructView(data: TabBase<any>): AdminView {
        return new AdminView(data);
    }
}
