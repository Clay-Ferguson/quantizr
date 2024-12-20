import * as d3 from "d3";
import { Svg } from "./Svg";
import { Comp, CompT } from "../base/Comp";

export class PieChart extends Comp {

    constructor(private width: number, private className: string, private data: any[]) {
        super({ className: "mb-3" });
    }

    override preRender(): CompT[] | boolean | null {
        return [new Svg({ className: this.className })];
    }

    override _domPreUpdateEvent = () => {
        const svg = d3.select("." + this.className);

        // width/height must match d3PieChart scss class
        const height = this.width;
        const radius = Math.min(this.width, height) / 2;
        const g = svg.append("g").attr("transform", "translate(" + this.width / 2 + "," + height / 2 + ")");

        const colors = [];
        for (const d of this.data) {
            colors.push(d.color);
        }

        const color = d3.scaleOrdinal(colors);

        // Generate the pie
        const pie = d3.pie().value((d: any) => d.value);

        // Generate the arcs
        const arc: any = d3.arc()
            .innerRadius(0)
            .outerRadius(radius);

        // Generate groups
        const arcs = g.selectAll("." + this.className)
            .data(pie(this.data))
            .enter()
            .append("g")
            .attr("class", "arc");

        // Draw arc paths
        arcs.append("path")
            .attr("fill", (_d: any, i: any) => color(i))
            .attr("d", arc);

        arcs.append("text")
            .attr("transform", (d: any) => {
                d.innerRadius = 0;
                d.outerRadius = this.width;
                return "translate(" + arc.centroid(d) + ")";
            })
            .attr("text-anchor", "middle")
            .text((_d: any, i: any) => this.data[i].label)
    }
}
