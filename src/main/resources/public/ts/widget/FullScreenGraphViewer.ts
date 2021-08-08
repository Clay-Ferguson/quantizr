import * as d3 from "d3";
import { AppState } from "../AppState";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Div } from "./Div";
import { Main } from "./Main";
import { Constants as C } from "../Constants";

// https://observablehq.com/@d3/force-directed-tree
// https://www.npmjs.com/package/d3
// https://d3js.org/

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FullScreenGraphViewer extends Main {
    nodeId: string;
    simulation: any;
    tooltip: any;
    isDragging: boolean;

    constructor(appState: AppState) {
        super();
        this.domRemoveEvent = this.domRemoveEvent.bind(this);
        this.domUpdateEvent = this.domUpdateEvent.bind(this);
        this.domPreUpdateEvent = this.domPreUpdateEvent.bind(this);

        this.nodeId = appState.fullScreenGraphId;
        let node: J.NodeInfo = S.quanta.findNodeById(appState, this.nodeId);

        if (!node) {
            console.log("Can't find nodeId " + this.nodeId);
        }

        S.util.ajax<J.GraphRequest, J.GraphResponse>("graphNodes", {
            searchText: appState.graphSearchText,
            nodeId: this.nodeId
        }, (resp: J.GraphResponse) => {
            this.mergeState({ data: resp.rootNode });
        });
    }

    preRender(): void {
        this.setChildren([new Div(null, { className: "d3Graph" })]);
    }

    domPreUpdateEvent(): void {
        let elm = this.getRef();
        let state = this.getState();
        if (!state.data) return;

        let customForceDirectedTree = this.forceDirectedTree();

        d3.select(".d3Graph")
            .datum(state.data)
            .call(customForceDirectedTree);
        super.domPreUpdateEvent();
    }

    forceDirectedTree = () => {
        let _this = this;
        let margin = { top: 0, right: 0, bottom: 0, left: 0 };
        let width = window.innerWidth;
        let height = window.innerHeight;

        function chart(selection) {
            let data = selection.datum();
            let chartWidth = width - margin.left - margin.right;
            let chartHeight = height - margin.top - margin.bottom;

            let root = d3.hierarchy(data);
            let links = root.links();
            let nodes = root.descendants();

            let simulation = d3.forceSimulation(nodes)
                .force("link", d3.forceLink(links).id(d => d.id).distance(0).strength(1))
                .force("charge", d3.forceManyBody().strength(-50))
                .force("x", d3.forceX())
                .force("y", d3.forceY());

            _this.tooltip = selection
                .append("div")
                .attr("class", "tooltip alert alert-secondary")
                .style("font-size", "14px")
                .style("pointer-events", "none");

            let mouseover = (event: any, d) => {
                if (d.data.id.startsWith("/")) {
                    _this.updateTooltip(d, event.pageX, event.pageY);
                }
                else {
                    _this.showTooltip(d, event.pageX, event.pageY);
                }
            };

            let mouseout = () => {
                _this.tooltip.transition()
                    .duration(300)
                    .style("opacity", 0);
            };

            let drag = function (simulation) {
                function dragstarted(event, d) {
                    _this.isDragging = true;
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                }

                function dragged(event, d) {
                    d.fx = event.x;
                    d.fy = event.y;
                }

                function dragended(event, d) {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                    _this.isDragging = false;
                }

                return d3.drag()
                    .on("start", dragstarted)
                    .on("drag", dragged)
                    .on("end", dragended);
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
            let g = svg.append("g");

            let link = g.append("g")
                .attr("stroke", "#999")
                .attr("stroke-width", 1.5)
                .attr("stroke-opacity", 0.6)
                .selectAll("line") // PathShape (leave this comment, referenced below)
                .data(links)
                .join("line"); // PathShape (leave this comment, referenced below)

            let node = g.append("g")
                .attr("stroke-width", 1.5)
                .style("cursor", "pointer")
                .selectAll("circle")
                .data(nodes)
                .join("circle")

                .attr("fill", d => {
                    if (d.data.id === _this.nodeId) return "red";
                    return d.data.highlight ? "green" : "black";
                })
                .attr("stroke", d => {
                    return _this.getColorForLevel(d.data.level);
                })
                .attr("r", d => {
                    if (d.data.id === _this.nodeId) return 5;
                    return 3.5;
                })

                .on("mouseover", mouseover)
                .on("mouseout", mouseout)

                .on("click", function (event: any, d) {
                    d3.select(this)
                        .style("fill", "white")
                        .style("stroke", "red");

                    _this.tooltip.text("Opening...")
                        .style("left", (event.pageX + 15) + "px")
                        .style("top", (event.pageY - 50) + "px");

                    // use timeout to give user time to notice the circle was colored white now
                    setTimeout(() => {
                        if (d.data.id) {
                            window.open(S.util.getHostAndPort() + "/app?id=" + d.data.id, "_blank");
                        }
                    }, 1000);
                })

                .call(drag(simulation));

            simulation.on("tick", () => {
                // -------------------
                // DO NOT DELETE (if PathShape (above) is 'path' use this)
                // link.attr("d", function (d) {
                //     let dx = d.target.x - d.source.x;
                //     let dy = d.target.y - d.source.y;
                //     let dr = Math.sqrt(dx * dx + dy * dy);
                //     return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 1 0,1 " + d.target.x + "," + d.target.y;
                // });
                // node
                //     .attr("cx", d => d.x)
                //     .attr("cy", d => d.y);
                // -------------------

                // If PathShape (above) is 'line' do this
                link
                    .attr("x1", d => d.source.x)
                    .attr("y1", d => d.source.y)
                    .attr("x2", d => d.target.x)
                    .attr("y2", d => d.target.y);

                node
                    .attr("cx", d => d.x)
                    .attr("cy", d => d.y);
            });

            let zoomHandler = d3.zoom()
                .on("zoom", zoomAction);

            function zoomAction(event) {
                const { transform } = event;
                g.attr("stroke-width", 1 / transform.k);
                g.attr("transform", transform);
            }
            zoomHandler(svg);
        }
        return chart;
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

    updateTooltip = (d: any, x: number, y: number) => {
        const res = S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
            nodeId: d.data.id,
            upLevel: false,
            siblingOffset: 0,
            renderParentIfLeaf: false,
            offset: 0,
            goToLastPage: false,
            forceIPFSRefresh: false,
            singleNode: true
        },
            (res: J.RenderNodeResponse) => {
                if (res.node) {
                    let content = res.node.content;
                    if (content.length > 100) {
                        content = content.substring(0, 100) + "...";
                    }
                    d.data.name = content;
                    this.showTooltip(d, x, y);
                }
            });
    }

    showTooltip = (d: any, x: number, y: number) => {
        this.tooltip.transition()
            .duration(300)
            .style("opacity", (d) => !this.isDragging ? 0.97 : 0);

        // DO NOT DELETE (example for how to use HTML)
        // this.tooltip.html(() => {
        //     return "<div class='alert alert-secondary'>" + d.data.name + "</div>";
        // })
        this.tooltip.text(d.data.name)
            .style("left", (x + 15) + "px")
            .style("top", (y - 50) + "px");
    }

    domRemoveEvent(): void {
        this.stopSim();
    }

    domUpdateEvent(): void {
        // #DEBUG-SCROLLING
        // console.log("scrollTop=0");
        if (S.view.docElm) {
            S.view.docElm.scrollTop = 0;
        }
        super.domUpdateEvent();
    }

    stopSim = () => {
        if (this.simulation) {
            this.simulation.stop();
            this.simulation = null;
        }
    }
}
