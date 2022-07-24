import { Html } from "./Html";
import { S } from "../../Singletons";

export class Markdown extends Html {

    constructor(private text: string) {
        super(S.util.markdown(text));
        this.attribs.className = "markdown-content";
    }
}
