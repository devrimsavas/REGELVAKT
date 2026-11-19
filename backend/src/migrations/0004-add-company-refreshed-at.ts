import { DataTypes } from "sequelize";
import type { Migration } from "../config/migrator.js";

// When the company snapshot was last fetched from Brreg. The reminder job
// refreshes it for assessments with reminders, so a change in Brreg (such
// as a new VAT registration) reaches the reminders.
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.addColumn("assessments", "company_refreshed_at", {
    type: DataTypes.DATE,
    allowNull: true,
  });
  // Existing assessments were fetched when they were made
  await queryInterface.sequelize.query(
    "UPDATE assessments SET company_refreshed_at = created_at",
  );
  await queryInterface.changeColumn("assessments", "company_refreshed_at", {
    type: DataTypes.DATE,
    allowNull: false,
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.removeColumn("assessments", "company_refreshed_at");
};
