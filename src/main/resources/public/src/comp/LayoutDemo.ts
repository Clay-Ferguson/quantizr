import { getAs } from "../AppContext";
import { Div } from "./core/Div";
import { Progress } from "./core/Progress";
import { Main } from "./Main";

/* This is just a scratchpad for testing layout components and styles. */
export class LayoutDemo extends Main {

    constructor() {
        super(null, { id: "appPanelId", role: "main" });
    }

    override preRender(): boolean | null {
        const ast = getAs();

        if (!ast.appInitComplete) {
            this.children = [new Progress()];
            return true;
        }

        const children = [];
        children.push(new Div("Tailwind CSS", {
            className: "tw-bg-blue-500 tw-p-4 tw-rounded"
        }));

        for (let i = 0; i < 10; i++) {
            children.push(new Div("Brick" + i, {
                className: "brick brickWidth100px brickInline",
            }));
        }

        this.children = [
            new Div("Div with inline-block children"),
            new Div(null, {
                className: "brickRow",
                id: "appMainContainer"
            }, children)
        ];
        return true;
    }
}
