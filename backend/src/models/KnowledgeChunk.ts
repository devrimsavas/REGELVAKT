import {
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from "sequelize-typescript";
import { KnowledgePage } from "./KnowledgePage.js";

// A section of a page. The search column is made by PostgreSQL and only
// used in the search query, so the model leaves it out.
@Table({ tableName: "knowledge_chunks", underscored: true, timestamps: false })
export class KnowledgeChunk extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  // Only KnowledgePage declares the association, as with Subscription
  @ForeignKey(() => KnowledgePage)
  @Column({ type: DataType.UUID, allowNull: false })
  declare pageId: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare position: number;

  @Column({ type: DataType.STRING(300), allowNull: false })
  declare heading: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare text: string;
}
