import * as d3 from "d3";
import { Div } from "./Div";
import { Svg } from "./Svg";

interface LS { // Local State
}

export class PieChart extends Div {

    constructor(private width: number, private className: string, private data: any[]) {
        super(null, { className: "marginBottom" });
    }

    preRender(): void {
        this.setChildren([new Svg(null, { className: this.className })]);
    }

    domPreUpdateEvent = (): void => {
        // console.log("domPreUpdateEvent: " + S.util.prettyPrint(this.data));
        // let state = this.getState<LS>();
        let svg = d3.select("." + this.className);

        // width/height must match d3PieChart scss class
        let height = this.width;
        let radius = Math.min(this.width, height) / 2;
        let g = svg.append("g").attr("transform", "translate(" + this.width / 2 + "," + height / 2 + ")");

        let colors = [];
        for (let d of this.data) {
            colors.push(d.color);
        }

        var color = d3.scaleOrdinal(colors);

        // Generate the pie
        var pie = d3.pie().value((d: any) => { return d.value; });

        // Generate the arcs
        var arc = d3.arc()
            .innerRadius(0)
            .outerRadius(radius);

        // Generate groups
        var arcs = g.selectAll("." + this.className)
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
            .attr("transform", (d) => {
                d.innerRadius = 0;
                d.outerRadius = this.width;
                return "translate(" + arc.centroid(d) + ")";
            })
            .attr("text-anchor", "middle")
            .text((d, i) => {
                return this.data[i].label;
            });
    }
}
