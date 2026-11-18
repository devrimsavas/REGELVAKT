import { DataTypes } from "sequelize";
import type { Migration } from "../config/migrator.js";

// One assessment: a company, the user's answers and the rules version used.
// The result itself is not stored; it is recalculated from the rules.
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.createTable("assessments", {
    // Random id, so assessment URLs cannot be guessed
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    org_number: {
      type: DataTypes.CHAR(9),
      allowNull: false,
    },
    // The company as Brreg described it when the assessment was made
    company_snapshot: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    answers: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    // The rules version that produced the first result, e.g. "2026.1"
    rules_version: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  await queryInterface.addIndex("assessments", ["org_number"]);
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.dropTable("assessments");
};
