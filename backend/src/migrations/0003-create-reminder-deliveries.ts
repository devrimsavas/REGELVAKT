import { DataTypes } from "sequelize";
import type { Migration } from "../config/migrator.js";

// The reminders that have been sent. One row per subscription, obligation,
// deadline and number of days before it, so a reminder is never sent twice,
// even when the reminder job runs again.
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.createTable("reminder_deliveries", {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    subscription_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "subscriptions", key: "id" },
      onDelete: "CASCADE",
    },
    // An obligation id from the rules, e.g. "vat-return"
    obligation_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    deadline: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    days_before: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  await queryInterface.addIndex(
    "reminder_deliveries",
    ["subscription_id", "obligation_id", "deadline", "days_before"],
    { unique: true, name: "reminder_deliveries_unique" },
  );
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.dropTable("reminder_deliveries");
};
