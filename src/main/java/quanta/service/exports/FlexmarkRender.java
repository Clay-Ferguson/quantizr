package quanta.service.exports;

import java.util.ArrayList;
import java.util.List;

import com.vladsch.flexmark.ext.anchorlink.AnchorLinkExtension;
import com.vladsch.flexmark.ext.autolink.AutolinkExtension;
import com.vladsch.flexmark.ext.tables.TablesExtension;
import com.vladsch.flexmark.ext.toc.TocExtension;
import com.vladsch.flexmark.ext.toc.internal.TocOptions;
import com.vladsch.flexmark.html.HtmlRenderer;
import com.vladsch.flexmark.parser.Parser;
import com.vladsch.flexmark.util.ast.Node;
import com.vladsch.flexmark.util.data.MutableDataSet;
import com.vladsch.flexmark.util.misc.Extension;
import quanta.exception.base.RuntimeEx;

public class FlexmarkRender {
    public MutableDataSet options;
    public List<Extension> extensions;

    public String markdownToHtml(String markdown) {
        try {
            extensions = new ArrayList<>();
            extensions.add(TablesExtension.create());
            extensions.add(TocExtension.create());
            extensions.add(AnchorLinkExtension.create());
            extensions.add(AutolinkExtension.create());

            options = new MutableDataSet();
            options.set(Parser.EXTENSIONS, extensions);
            // We start the TOC at level 2 because level 1 is the title of the document itself, and the root
            // node.
            options.set(TocExtension.LEVELS, TocOptions.getLevels(2, 3, 4, 5, 6));
            // This numbering works in the TOC but I haven't figured out how to number the
            // actual headings in the body of the document itself.
            // options.set(TocExtension.IS_NUMBERED, true);

            Parser parser = Parser.builder(options).build();
            HtmlRenderer renderer = HtmlRenderer.builder(options).build();
            Node document = parser.parse(markdown);
            String html = renderer.render(document);
            return html;
        } catch (Exception ex) {
            throw new RuntimeEx(ex);
        }
    }
}

