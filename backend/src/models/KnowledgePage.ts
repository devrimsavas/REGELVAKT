import { Column, DataType, HasMany, Model, Table } from "sequelize-typescript";
import { KnowledgeChunk } from "./KnowledgeChunk.js";

// An official page in the assistant's knowledge base (see migration 0006)
@Table({ tableName: "knowledge_pages", underscored: true })
export class KnowledgePage extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @Column({ type: DataType.STRING(500), allowNull: false })
  declare url: string;

  @Column({ type: DataType.STRING(300), allowNull: false })
  declare title: string;

  @Column({ type: DataType.CHAR(64), allowNull: false })
  declare contentHash: string;

  @Column({ type: DataType.DATE, allowNull: false })
  declare fetchedAt: Date;

  @HasMany(() => KnowledgeChunk)
  declare chunks?: KnowledgeChunk[];

  declare createdAt: Date;
  declare updatedAt: Date;
}
