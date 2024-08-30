import * as d3 from "d3";
import { getAs } from "../AppContext";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Main } from "./Main";

// https://observablehq.com/@d3/force-directed-tree
// https://www.npmjs.com/package/d3
// https://d3js.org/

export class FullScreenGraphViewer extends Main {
    static div: any = null;
    static sim: any;

    tooltip: any;
    isDragging: boolean;
    mouseOverTimeoutId: any;

    static reset() {
        FullScreenGraphViewer.div = null;
        if (FullScreenGraphViewer.sim) {
            FullScreenGraphViewer.sim.stop();
            FullScreenGraphViewer.sim = null;
        }
    }

    // This technique of overriding the _domUpdateEvent() method is used to ensure that the Graphg
    // DOM element which is not managed by react, is always maintained across renders, so that it
    // doesn't loose state
    override _domUpdateEvent = () => {
        const elm: HTMLElement = this.getRef();
        if (!elm || !elm.isConnected) return;

        let reload = false;
        if (!FullScreenGraphViewer.div) {
            FullScreenGraphViewer.div = document.createElement('div');
            FullScreenGraphViewer.div.className = "d3Graph";
            reload = true;
        }

        elm.appendChild(FullScreenGraphViewer.div);

        if (reload) {
            d3.select(".d3Graph").datum(getAs().graphData).call(this.forceDirectedTree());
        }

        if (S.view.docElm) {
            // NOTE: Since the docElm component doesn't manage scroll position, we can get away with
            // just setting scrollTop on it directly like this, instead of calling
            // 'elm.setScrollTop()'
            S.view.docElm.scrollTop = 0;
        }
    }

    forceDirectedTree() {
        /* We use 'thiz' to capture 'this' because the methods below to expect to have their own
         'this' that will be set based on code outside our control that is expected by the Graph
         Implementation itself. */
        const thiz = this;
        const ast = getAs();
        const nodeId = ast.fullScreenConfig.nodeId;

        return function (selection: any) {
            const margin = { top: 0, right: 0, bottom: 0, left: 0 };
            const width = window.innerWidth;
            const height = window.innerHeight;

            const data = selection.datum();
            const chartWidth = width - margin.left - margin.right;
            const chartHeight = height - margin.top - margin.bottom;

            const root = d3.hierarchy(data);
            const links: any = root.links();
            const nodes: any = root.descendants();

            // Sort nodes by level so that the higher level nodes are drawn on top of lower level
            // nodes. we need do to this so we can always grab a clump of nodes centered around
            // their parent for example
            nodes.sort((a, b) => b.data.level - a.data.level);

            const nodeLinks: any = [];

            if (ast.showNodeLinksInGraph) {
                // map from any id to the node
                const nodesMap = new Map<string, string>();
                nodes.forEach((n: any) => {
                    nodesMap.set(n.data.id, n);
                });

                // for each node add links
                nodes.forEach((n: any) => {
                    // does node have elinks
                    if (n.data.links) {
                        // scan each link (link will be object with {id, name} of a target)
                        n.data.links.forEach(link => {
                            const nt: any = nodesMap.get(link.id);
                            if (nt) {
                                nodeLinks.push({ source: n, target: nt });
                            }
                        });
                    }
                });
            }
        
            FullScreenGraphViewer.sim = d3.forceSimulation(nodes)
                .force("link", d3.forceLink(ast.attractionLinksInGraph ? [...links, ...nodeLinks] : links) //
                    .id(function (d: any) { return d.id; }).distance(5)
                    .strength(1)
                )

                .force("charge", d3.forceManyBody().strength(-50))
                .force("x", d3.forceX())
                .force("y", d3.forceY());

            thiz.tooltip = selection
                .append("div")
                .attr("class", "tooltip graphPopup")
                .style("pointer-events", "none");

            const drag = function (simulation: any) {
                return d3.drag()
                    .on("start", function (event: any, d: any) {
                        thiz.isDragging = true;
                        if (!event.active) simulation.alphaTarget(0.3).restart();
                        d.fx = d.x;
                        d.fy = d.y;
                    })
                    .on("drag", function (event: any, d: any) {
                        d.fx = event.x;
                        d.fy = event.y;
                    })
                    .on("end", function (event: any, d: any) {
                        if (!event.active) simulation.alphaTarget(0);
                        d.fx = null;
                        d.fy = null;
                        thiz.isDragging = false;
                    });
            };

            let svg = selection
                .selectAll("svg")
                .data([data])
                .enter()
                .append("svg")
                .attr("width", chartWidth)
                .attr("height", chartHeight)
                .style("cursor", "move")
                .attr("viewBox", [-window.innerWidth / 2, -window.innerHeight / 2, window.innerWidth, window.innerHeight]);
            svg = svg.merge(svg);
            const g = svg.append("g");

            const link = g.append("g")
                .attr("stroke", "#999")
                // Tip: Do not Delete:
                // (I think many (most?) of these things that support a value also
                // support using a function to return the val based on data like
                // this example)
                // .style("stroke", function (d: any) {
                //     return "#999"
                // })
                .attr("stroke-width", 1)
                .attr("stroke-opacity", 0.6)
                .selectAll("line")
                .data(links)
                .join("line");

            let nodeLink: any = null;
            if (ast.showNodeLinksInGraph && nodeLinks?.length > 0) {
                nodeLink = g.append("g")
                    .style("stroke", function (_d: any) {
                        return "green"
                    })
                    .attr("stroke-width", 1)
                    .attr("stroke-opacity", 0.6)
                    .attr("stroke-dasharray", "1,1")
                    .selectAll("line")
                    .data(nodeLinks)
                    .join("line");
            }

            const node = g.append("g")
                .attr("stroke-width", 1.2)
                .style("cursor", "pointer")
                .selectAll("circle")
                .data(nodes)
                .join("circle")

                .attr("fill", function (d: any) {
                    let color = "black";
                    if (d.data.id === nodeId) {
                        color = "red";
                    }
                    else if (d.data.highlight) {
                        color = "green";
                    }
                    return color;
                })
                .attr("stroke", function (d: any) {
                    return thiz.getColorForLevel(d.data.level);
                })
                .attr("r", function (d: any) {
                    if (d.data.id === nodeId) return 5;
                    return 3.5;
                })

                .on("mouseover", function (event: any, d: any) {
                    if (thiz.mouseOverTimeoutId) {
                        clearTimeout(thiz.mouseOverTimeoutId);
                        thiz.mouseOverTimeoutId = null;
                    }

                    thiz.mouseOverTimeoutId = setTimeout(() => {
                        if (d.data.id.startsWith("/")) {
                            thiz.updateTooltip(d, event.pageX, event.pageY);
                        }
                        else {
                            thiz.showTooltip(d, event.pageX, event.pageY);
                        }
                        thiz.mouseOverTimeoutId = null;
                    }, 800);
                })
                .on("mouseout", function () {
                    if (thiz.mouseOverTimeoutId) {
                        clearTimeout(thiz.mouseOverTimeoutId);
                        thiz.mouseOverTimeoutId = null;
                    }
                    thiz.tooltip.transition()
                        .duration(300)
                        .style("opacity", 0);
                })

                .on("click", function (_event: any, d: any) {
                    d3.select(this)
                        .style("fill", "green");

                    if (d.data.id) {
                        if (S.util.ctrlKeyCheck()) {
                            window.open(S.util.getHostAndPort() + "?id=" + d.data.id, "_blank");
                        }
                        else {
                            S.view.jumpToId(d.data.id);
                        }
                    }
                })
                .call(drag(FullScreenGraphViewer.sim));

            FullScreenGraphViewer.sim.on("tick", function () {
                link
                    .attr("x1", function (d: any) { return d.source.x; })
                    .attr("y1", function (d: any) { return d.source.y; })
                    .attr("x2", function (d: any) { return d.target.x; })
                    .attr("y2", function (d: any) { return d.target.y; });

                if (ast.showNodeLinksInGraph && nodeLink && nodeLinks?.length > 0) {
                    nodeLink
                        .attr("x1", function (d: any) { return d.source.x; })
                        .attr("y1", function (d: any) { return d.source.y; })
                        .attr("x2", function (d: any) { return d.target.x; })
                        .attr("y2", function (d: any) { return d.target.y; });
                }

                node
                    .attr("cx", function (d: any) { return d.x; })
                    .attr("cy", function (d: any) { return d.y; });
            });

            const zoomHandler = d3.zoom()
                .on("zoom", function (event: any) {
                    const { transform } = event;
                    g.attr("stroke-width", 1 / transform.k);
                    g.attr("transform", transform);
                });

            zoomHandler(svg);

            // This works but we don't need it.
            // let initZoom = 1.5
            // zoomHandler.scaleTo(svg, initZoom);
        };
    }

    getColorForLevel(level: number): string {
        switch (level) {
            case 1:
                return "red";
            case 2:
                return "orange";
            case 3:
                return "blueviolet";
            case 4:
                return "brown";
            case 5:
                return "blue";
            case 6:
                return "deeppink";
            case 7:
                return "darkcyan";
            case 8:
                return "orange";
            case 9:
                return "purple";
            case 10:
                return "brown";
            case 11:
                return "slateblue";
            case 12:
                return "slategrey";
            default:
                return "#fff";
        }
    }

    async updateTooltip(d: any, x: number, y: number) {
        const res = await S.rpcUtil.rpc<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
            nodeId: d.data.id,
            upLevel: false,
            siblingOffset: 0,
            forceRenderParent: false,
            offset: 0,
            goToLastPage: false,
            singleNode: true,
            jumpToRss: false
        });
        S.nodeUtil.processInboundNode(res.node);

        if (res?.node) {
            d.data.name = res.node.content;
            this.showTooltip(d, x, y);
        }
    }

    showTooltip(d: any, _x: number, _y: number) {
        this.tooltip.transition()
            .duration(300)
            .style("opacity", (_d: any) => this.isDragging ? 0 : 0.97);

        let content = d.data.name;
        if (d.data.links) {
            content += "<div class='popupNodeLinks'>";
            Object.keys(d.data.links).forEach(key => {
                content += "<span class='nodeLink'>" + d.data.links[key].n + "</span>";
            });
            content += "</div>";
        }

        this.tooltip.html(() => "<div>" + content + "</div>");
    }
}
