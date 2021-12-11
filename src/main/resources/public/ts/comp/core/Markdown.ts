import { Html } from "./Html";
import { S } from "../../Singletons";

export class Markdown extends Html {

    constructor(private text: string) {
        super(S.util.markdown(text), null, null);
        this.attribs.className = "markdown-content";
    }
}
