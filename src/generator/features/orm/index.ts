import type { Orm } from "../../../options/option-types.js";
import type { OrmKit } from "./orm-kit.js";

import { hasDatabase } from "../../../options/option-rules.js";
import { defineFeature } from "../../feature.js";
import { drizzleKit } from "./drizzle.kit.js";
import { mikroOrmKit } from "./mikroorm.kit.js";
import { mongooseKit } from "./mongoose.kit.js";
import { prismaKit } from "./prisma.kit.js";
import { sequelizeKit } from "./sequelize.kit.js";
import { typeormKit } from "./typeorm.kit.js";

export const ORM_KITS: Readonly<Record<Exclude<Orm, "none">, OrmKit>> = {
  drizzle: drizzleKit,
  mikroorm: mikroOrmKit,
  mongodb: mongooseKit,
  prisma: prismaKit,
  sequelize: sequelizeKit,
  typeorm: typeormKit,
};

export const ormKitFor = (orm: Orm): OrmKit | undefined =>
  orm === "none" ? undefined : ORM_KITS[orm];

/** Root database wiring for the chosen ORM. */
export const ormFeature = defineFeature({
  apply(blueprint, options) {
    ormKitFor(options.orm)?.apply(blueprint, options);
  },
  isEnabled: hasDatabase,
  name: "orm",
});
