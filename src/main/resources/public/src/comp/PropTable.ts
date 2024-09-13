import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { PropTableCell } from "../comp/PropTableCell";
import { PropTableRow } from "../comp/PropTableRow";
import { Table } from "./Table";
import { Comp } from "./base/Comp";

export class PropTable extends Comp {
    constructor(private node: NodeInfo) {
        super();
    }

    override preRender(): boolean | null {
        const children = [];
        const type = S.plugin.getType(this.node.type);
        if (this.node.properties) {
            this.node.properties.forEach(prop => {
                const propConfig = type.getPropConfig(prop.name);
                const label = propConfig?.label || (type ? type.getEditLabelForProp(this.node, prop.name) : prop.name);
                const comment = type.getSchemaOrgPropComment(prop.name);
                const propType = type.getType(prop.name);
                const displayVal = S.util.formatProperty(prop.value, propType);

                if (S.props.isGuiControlBasedProp(prop) || S.props.isHiddenProp(prop)) return;
                const ptr = new PropTableRow({
                    title: "Property: " + prop.name + (comment ? ("\n\n" + comment) : ""),
                    className: "propTableRow"
                }, [
                    new PropTableCell(label, {
                        className: "propTableNameCol"
                    }),
                    new PropTableCell(displayVal, {
                        className: "propTableValCol"
                    })
                ]);
                ptr.ordinal = propConfig?.ord || 200;
                children.push(ptr);
            });
        }
        if (children.length === 0) return null;
        children.sort((a, b) => a.ordinal - b.ordinal);

        this.attribs.className = "scrollingPropsTable";
        this.children = [
            new Table({ className: "customScrollBar smallMarginRight" }, children)
        ];
        return true;
    }
}
