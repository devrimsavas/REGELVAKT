import { DataTypes } from "sequelize";
import type { Migration } from "../config/migrator.js";

// Email reminders for one assessment. A subscription is "pending" until the
// link in the confirmation email is used, and only "active" ones get
// reminders. Unsubscribing deletes the row, email address included.
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.createTable("subscriptions", {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    // Deleting the assessment deletes its subscriptions
    assessment_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "assessments", key: "id" },
      onDelete: "CASCADE",
    },
    // Stored trimmed and in lower case; 254 is the longest valid address
    email: {
      type: DataTypes.STRING(254),
      allowNull: false,
    },
    // Language of the emails: "nb" or "en"
    language: {
      type: DataTypes.STRING(2),
      allowNull: false,
    },
    // How many days before each deadline to remind, e.g. {14,3}
    reminder_days: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      allowNull: false,
    },
    // "pending" or "active"
    status: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    // SHA-256 of the token in the confirmation link; the token itself is
    // only in the email
    confirm_token_hash: {
      type: DataTypes.CHAR(64),
      allowNull: true,
      unique: true,
    },
    confirm_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // When the user agreed to get the emails, and when they confirmed
    consented_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    confirmed_at: {
      type: DataTypes.DATE,
      allowNull: true,
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

  // One subscription per address and assessment
  await queryInterface.addIndex("subscriptions", ["assessment_id", "email"], {
    unique: true,
  });
  // For the per-address limit and the clean-up of unconfirmed ones
  await queryInterface.addIndex("subscriptions", ["status", "created_at"]);
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.dropTable("subscriptions");
};
