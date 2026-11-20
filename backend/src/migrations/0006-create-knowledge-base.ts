import { DataTypes } from "sequelize";
import type { Migration } from "../config/migrator.js";

// The assistant's knowledge base: official pages, split into sections.
// The text is kept only to search in; answers link to the page itself.
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.createTable("knowledge_pages", {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING(500),
      allowNull: false,
      unique: true,
    },
    title: {
      type: DataTypes.STRING(300),
      allowNull: false,
    },
    // SHA-256 of the page's text: an unchanged page is not split again
    content_hash: {
      type: DataTypes.CHAR(64),
      allowNull: false,
    },
    fetched_at: {
      type: DataTypes.DATE,
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

  await queryInterface.createTable("knowledge_chunks", {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    page_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "knowledge_pages", key: "id" },
      onDelete: "CASCADE",
    },
    // Order on the page, from 0
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // The heading the section is under; the page title for the first one
    heading: {
      type: DataTypes.STRING(300),
      allowNull: false,
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  });

  // Full-text search in Norwegian: words are reduced to their stem, so
  // "mva-meldingen" also finds "mva-melding". Kept up to date by PostgreSQL;
  // the heading weighs more than the text.
  await queryInterface.sequelize.query(`
    ALTER TABLE knowledge_chunks ADD COLUMN search tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('norwegian', heading), 'A') ||
      setweight(to_tsvector('norwegian', text), 'B')
    ) STORED
  `);
  await queryInterface.sequelize.query(
    "CREATE INDEX knowledge_chunks_search ON knowledge_chunks USING GIN (search)",
  );
  await queryInterface.addIndex("knowledge_chunks", ["page_id", "position"], {
    unique: true,
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.dropTable("knowledge_chunks");
  await queryInterface.dropTable("knowledge_pages");
};
