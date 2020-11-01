import * as d3 from "d3";
import { AppState } from "../AppState";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Div } from "./Div";
import { Main } from "./Main";
import { Constants as C } from "../Constants";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FullScreenGraphViewer extends Main {

    constructor(appState: AppState) {
        super();
        let nodeId = appState.fullScreenGraphId;
        let node: J.NodeInfo = S.meta64.findNodeById(appState, nodeId);

        if (!node) {
            console.log("Can't find nodeId " + nodeId);
        }

        S.util.ajax<J.GraphRequest, J.GraphResponse>("graphNodes", {
            nodeId
        }, (resp: J.GraphResponse) => {
            this.mergeState({ data: resp.rootNode });
        });
    }

    preRender(): void {
        this.setChildren([new Div(null, { className: "d3Graph" })]);
    }

    domPreUpdateEvent = (): void => {
        let state = this.getState();
        if (!state.data) return;

        const root = d3.hierarchy(state.data);
        const links = root.links();
        const nodes = root.descendants();

        const zoom = d3.zoom()
            .scaleExtent([1, 8])
            .on("zoom", zoomed);

        const simulation = d3.forceSimulation(nodes)
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

        // todo-0: what is the 'append("g")' i keep seeing.

        const link = svg.append("g")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6)
            .selectAll("line")
            .data(links)
            .join("line");

        const node = svg.append("g")
            .attr("fill", "#fff")
            .attr("stroke", "#000")
            .attr("stroke-width", 1.5)
            .selectAll("circle")
            .data(nodes)
            .join("circle")
            .attr("fill", d => d.children ? null : "#000")
            .attr("stroke", d => d.children ? null : "#fff")
            .attr("r", 3.5)
            .call(this.drag(simulation));

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

        node.append("title").text(d => d.data.name);

        simulation.on("tick", () => {
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
