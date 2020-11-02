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

    simulation: any;

    constructor(appState: AppState) {
        super();
        let nodeId = appState.fullScreenGraphId;
        let node: J.NodeInfo = S.meta64.findNodeById(appState, nodeId);

        if (!node) {
            console.log("Can't find nodeId " + nodeId);
        }

        S.util.ajax<J.GraphRequest, J.GraphResponse>("graphNodes", {
            searchText: appState.graphSearchText,
            nodeId
        }, (resp: J.GraphResponse) => {
            this.mergeState({ data: resp.rootNode });
        });
    }

    preRender(): void {
        this.setChildren([new Div(null, { className: "d3Graph" })]);
    }

    domPreUpdateEvent = (): void => {
        let _this = this;
        let state = this.getState();
        if (!state.data) return;

        const root = d3.hierarchy(state.data);
        const links = root.links();
        const nodes = root.descendants();

        const zoom = d3.zoom()
            .scaleExtent([1, 8])
            .on("zoom", zoomed);

        this.stopSim();

        this.simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(0).strength(1))
            .force("charge", d3.forceManyBody().strength(-50))
            .force("x", d3.forceX())
            .force("y", d3.forceY());

        const svg = d3.select(".d3Graph")
            .append("svg")
            .attr("width", "100%")
            .attr("viewBox", [-window.innerWidth / 2, -window.innerHeight / 2, window.innerWidth, window.innerHeight])
            .style("pointer-events", "all");

        function zoomed(event) {
            const { transform } = event;
            svg.attr("transform", transform);
            svg.attr("stroke-width", 1 / transform.k);
        }

        const link = svg.append("g")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6)
            .selectAll("line")
            .data(links)
            .join("line");

        const node = svg.append("g")
            // .attr("fill", "#fff")
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .style("cursor", "pointer")
            .selectAll("circle")
            .data(nodes)
            .join("circle")
            .attr("fill", d => {
                return d.data.id.startsWith("/") ? "#000" : "slateblue";
            })
            // .attr("stroke", d => d.children ? null : "#fff")
            // .attr("stroke", "#fff")
            .attr("r", 3.5)
            .call(this.drag(this.simulation));

        node.on("click", function () {
            let circle = d3.select(this);
            let node = circle.node();
            let data: J.GraphNode = node.__data__.data;
            circle
                // .style("fill", "lightcoral")
                .style("stroke", "green");

            if (data.id) {
                window.open(S.util.getHostAndPort() + "/app?id=" + data.id, "_blank");
            }
        });

        node.on("mouseover", function () {
            let circle = d3.select(this);
            let node = circle.node();
            let data: J.GraphNode = node.__data__.data;

            let title = circle.select("title");
            if (data.id.startsWith("/")) {
                title.text("Loading...");
                _this.updateText(data.id, title);
            }
        });

        node.append("title").text(d => d.data.name || d.data.id);

        this.simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
        });

        svg.call(zoom);

        // todo-0: need to do this cleanup.
        // invalidation.then(() => simulation.stop());
    }

    domRemoveEvent = () => {
        this.stopSim();
    }

    stopSim = () => {
        if (this.simulation) {
            this.simulation.stop();
            this.simulation = null;
        }
    }

    updateText = (nodeId: string, title: any) => {
        const res = S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
            nodeId,
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
                    title.text(content);
                }
            });
    }

    drag = simulation => {

        function dragstarted(event, d) {
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
        }

        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }
}
