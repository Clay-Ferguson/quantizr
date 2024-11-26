import { getAs } from "../AppContext";
import { AppTab } from "../comp/AppTab";
import { Button } from "../comp/core/Button";
import { Div } from "../comp/core/Div";
import { Html } from "../comp/core/Html";
import { Markdown } from "../comp/core/Markdown";
import { Pre } from "../comp/core/Pre";
import { TabBase } from "../intf/TabBase";
import { S } from "../Singletons";
import { Tailwind } from "../Tailwind";

export class ServerInfoView extends AppTab<any, ServerInfoView> {

    constructor(data: TabBase<any, ServerInfoView>) {
        super(data);
        data.inst = this;
    }

    override preRender(): boolean | null {
        const ast = getAs();
        let comp = null;

        const text = ast.serverInfoText.trim();
        switch (ast.serverInfoFormat) {
            case "html":
                comp = new Html(text);
                break;
            case "md":
                comp = new Markdown(text);
                break;
            // "txt" or anything else
            default:
                comp = new Pre(text, { className: "serverInfoText" })
        }

        this.children = [
            new Div(null, { className: "mt-3" }, [
                new Div(ast.serverInfoTitle, { className: "infoSectionTitle " + Tailwind.alertPrimary }),
                ast.serverInfoCommand === "getServerInfo" ? new Button("Refresh", () => {
                    S.view.runServerCommand("getServerInfo", null, "Info View", null);
                }, null, "-float-right") : null,
                comp
            ])
        ];
        return true;
    }
}
