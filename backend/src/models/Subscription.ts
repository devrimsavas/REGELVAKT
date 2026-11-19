import {
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from "sequelize-typescript";
import { Assessment } from "./Assessment.js";

export const EMAIL_LANGUAGES = ["nb", "en"] as const;
export type EmailLanguage = (typeof EMAIL_LANGUAGES)[number];

export type SubscriptionStatus = "pending" | "active";

// Email reminders for one assessment (see migration 0002)
@Table({ tableName: "subscriptions", underscored: true })
export class Subscription extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  // Only Assessment declares the association (HasMany). A BelongsTo here
  // would make the two model files need each other while they load.
  @ForeignKey(() => Assessment)
  @Column({ type: DataType.UUID, allowNull: false })
  declare assessmentId: string;

  @Column({ type: DataType.STRING(254), allowNull: false })
  declare email: string;

  @Column({ type: DataType.STRING(2), allowNull: false })
  declare language: EmailLanguage;

  @Column({ type: DataType.ARRAY(DataType.INTEGER), allowNull: false })
  declare reminderDays: number[];

  @Column({ type: DataType.STRING(10), allowNull: false })
  declare status: SubscriptionStatus;

  @Column({ type: DataType.CHAR(64), allowNull: true })
  declare confirmTokenHash: string | null;

  @Column({ type: DataType.DATE, allowNull: true })
  declare confirmExpiresAt: Date | null;

  @Column({ type: DataType.DATE, allowNull: false })
  declare consentedAt: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  declare confirmedAt: Date | null;

  declare createdAt: Date;
  declare updatedAt: Date;
}
