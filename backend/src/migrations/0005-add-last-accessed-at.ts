import { DataTypes } from "sequelize";
import type { Migration } from "../config/migrator.js";

// When the assessment was last used: read, changed or fetched as a
// calendar. Assessments without reminders are deleted when they have not
// been used for a while, instead of a fixed time after they were made, so
// someone who keeps using the page or the calendar keeps their data.
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.addColumn("assessments", "last_accessed_at", {
    type: DataTypes.DATE,
    allowNull: true,
  });
  await queryInterface.sequelize.query(
    "UPDATE assessments SET last_accessed_at = created_at",
  );
  await queryInterface.changeColumn("assessments", "last_accessed_at", {
    type: DataTypes.DATE,
    allowNull: false,
  });
  await queryInterface.addIndex("assessments", ["last_accessed_at"]);
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.removeColumn("assessments", "last_accessed_at");
};
