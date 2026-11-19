import {
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from "sequelize-typescript";
import { Subscription } from "./Subscription.js";

// A reminder that has been sent (see migration 0003)
@Table({
  tableName: "reminder_deliveries",
  underscored: true,
  timestamps: false,
})
export class ReminderDelivery extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @ForeignKey(() => Subscription)
  @Column({ type: DataType.UUID, allowNull: false })
  declare subscriptionId: string;

  @Column({ type: DataType.STRING(50), allowNull: false })
  declare obligationId: string;

  // YYYY-MM-DD
  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare deadline: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare daysBefore: number;

  @Column({ type: DataType.DATE, allowNull: false })
  declare sentAt: Date;
}
