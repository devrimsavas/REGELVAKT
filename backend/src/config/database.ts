import { Sequelize } from "sequelize-typescript";
import { requireEnv } from "./env.js";

export const sequelize = new Sequelize({
  dialect: "postgres",
  host: requireEnv("DB_HOST"),
  port: Number(requireEnv("DB_PORT")),
  database: requireEnv("DB_NAME"),
  username: requireEnv("DB_USER"),
  password: requireEnv("DB_PASSWORD"),
  // Models are listed here one by one as they are added
  models: [],
  logging: false,
});
