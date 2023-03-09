import { ReactNode } from "react";
import { Comp } from "./base/Comp";
import * as J from "../JavaIntf";
import { PropTableCell } from "../comp/PropTableCell";
import { PropTableRow } from "../comp/PropTableRow";
import { S } from "../Singletons";

export class PropTable extends Comp {

    constructor(private node: J.NodeInfo) {
        super({
            className: "property-table"
        });
    }

    compRender = (): ReactNode => {
        this.setChildren([]);
        if (this.node.properties) {
            this.node.properties.forEach(prop => {
                if (S.props.isGuiControlBasedProp(prop)) return;
                this.addChild(new PropTableRow({
                    className: "prop-table-row"
                }, [
                    new PropTableCell(prop.name, {
                        className: "prop-table-name-col"
                    }),
                    new PropTableCell(prop.value, {
                        className: "prop-table-val-col"
                    })
                ]));
            });
        }
        return this.tag("div", { className: "scrollingPropsTable" }, [
            this.tag("table", { className: "customScrollBar smallMarginRight" })
        ]);
    }
}
