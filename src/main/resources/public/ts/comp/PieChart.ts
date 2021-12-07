import * as d3 from "d3";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Div } from "./Div";
import { Svg } from "./Svg";
import { Constants as C } from "../Constants";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

interface LS {
}

export class PieChart extends Div {

    constructor(private data: any[]) {
        super(null, { className: "marginBottom" });
        this.domPreUpdateEvent = this.domPreUpdateEvent.bind(this);
    }

    preRender(): void {
        this.setChildren([new Svg(null, { className: "d3PieChart" })]);
    }

    domPreUpdateEvent(): void {
        // console.log("domPreUpdateEvent: " + S.util.prettyPrint(this.data));
        let state = this.getState<LS>();

        let svg = d3.select(".d3PieChart");

        // width/height must match d3PieChart scss class
        let width = 300; // svg.attr("width");
        let height = 300; // svg.attr("height");
        let radius = Math.min(width, height) / 2;
        let g = svg.append("g").attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

        let colors = [];
        for (let d of this.data) {
            colors.push(d.color);
        }

        var color = d3.scaleOrdinal(colors);

        // Generate the pie
        var pie = d3.pie().value(function (d) { return d.value; });

        // Generate the arcs
        var arc = d3.arc()
            .innerRadius(0)
            .outerRadius(radius);

        // Generate groups
        var arcs = g.selectAll(".d3PieChart")
            .data(pie(this.data))
            .enter()
            .append("g")
            .attr("class", "arc");

        // Draw arc paths
        arcs.append("path")
            .attr("fill", (d, i) => {
                return color(i);
            })
            .attr("d", arc);

        arcs.append("text")
            .attr("transform", function (d) {
                d.innerRadius = 0;
                d.outerRadius = 300;
                return "translate(" + arc.centroid(d) + ")";
            })
            .attr("text-anchor", "middle")
            .text((d, i) => {
                return this.data[i].label;
            });

        super.domPreUpdateEvent();
    }
}
