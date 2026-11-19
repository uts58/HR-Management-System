export type OrgUnitKind = "department" | "position";

/** Wording per kind (legacy "Manage Departments" / "Manage Positions"). */
export const ORG_UNIT_COPY: Record<
  OrgUnitKind,
  {
    title: string;
    singular: string;
    plural: string;
    nameLabel: string;
    addLabel: string;
  }
> = {
  department: {
    title: "Departments",
    singular: "Department",
    plural: "departments",
    nameLabel: "Department name",
    addLabel: "Add department",
  },
  position: {
    title: "Positions",
    singular: "Position",
    plural: "positions",
    nameLabel: "Position name",
    addLabel: "Add position",
  },
};
