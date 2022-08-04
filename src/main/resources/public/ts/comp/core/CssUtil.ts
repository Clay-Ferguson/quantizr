export class CssUtil {
    static create(cssText: string): Element {
        const css = document.createElement("style");
        css.innerHTML = cssText;
        document.body.appendChild(css);
        return css;
    }
}
