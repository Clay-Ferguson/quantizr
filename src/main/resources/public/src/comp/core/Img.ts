import { S } from "../../Singletons";
import { Comp } from "../base/Comp";

export class Img extends Comp {

    constructor(attribs: any = {}) {
        super(attribs);
        this.setTag("img");
    }

    // The brokenImages code is needed to make sure once we know an image is broken we remove it and NEVER
    // try rendering it again, or else we get flicker when it renders over and over.
    override preRender = (): boolean => {
        if (S.quanta.brokenImages.has(this.attribs.src)) {
            return null;
        }

        this.attribs.onError = () => {
            S.quanta.brokenImages.add(this.attribs.src);
            this.onMount(elm => { elm.style.display = "none"; });
        };

        return true;
    }
}
