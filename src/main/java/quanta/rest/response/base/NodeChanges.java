package quanta.rest.response.base;

/*
 * Used to package bulk ordinal changes (range inserts) made in batch in the DB during tree
 * operations, so we can efficiently update all node ordinals on the client side
 */
public class NodeChanges {

    // These two mean the DB has found all ordinals greater than or equal to ordinalShiftMin
    // and added to their ordinals ordinalShiftRange
    private String parentNodeId;
    private Integer ordinalShifMin;
    private Integer ordinalShiftRange;

    public String getParentNodeId() {
        return parentNodeId;
    }

    public void setParentNodeId(String parentNodeId) {
        this.parentNodeId = parentNodeId;
    }


    public Integer getOrdinalShifMin() {
        return ordinalShifMin;
    }

    public void setOrdinalShifMin(Integer ordinalShifMin) {
        this.ordinalShifMin = ordinalShifMin;
    }

    public Integer getOrdinalShiftRange() {
        return ordinalShiftRange;
    }

    public void setOrdinalShiftRange(Integer ordinalShiftRange) {
        this.ordinalShiftRange = ordinalShiftRange;
    }
}
