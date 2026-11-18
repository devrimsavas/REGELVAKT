import { Column, DataType, Model, Table } from "sequelize-typescript";
import type { Answers } from "../rules/types.js";
import type { Company } from "../types/company.js";

// Every column names its type explicitly. Vitest compiles without decorator
// metadata, so types inferred from TypeScript would be missing in tests.
@Table({ tableName: "assessments", underscored: true })
export class Assessment extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @Column({ type: DataType.CHAR(9), allowNull: false })
  declare orgNumber: string;

  @Column({ type: DataType.JSONB, allowNull: false })
  declare companySnapshot: Company;

  @Column({ type: DataType.JSONB, allowNull: false })
  declare answers: Answers;

  @Column({ type: DataType.STRING(20), allowNull: false })
  declare rulesVersion: string;

  declare createdAt: Date;
  declare updatedAt: Date;
}
