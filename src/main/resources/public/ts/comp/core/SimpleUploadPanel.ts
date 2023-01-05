import { Div } from "./Div";
import { S } from "../../Singletons";

export class SimpleUploadPanel extends Div {
    constructor() {
        super("Drop Files Here....", { className: "simpleUploadPanel" });
        this.addHandlers();
    }

    addHandlers = (): void => {
        S.domUtil.setDropHandler(this.attribs, (evt: DragEvent) => {
            if (evt.dataTransfer.files) {
                S.domUtil.uploadFilesToNode(evt.dataTransfer.files, "[auto]");
            }
        });
    }
}
